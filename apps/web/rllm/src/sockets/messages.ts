import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { Batcher } from '@tanstack/solid-pacer';
import { ethers } from 'ethers';
import type { MerkleTree } from 'event-logger';
import * as EventPB from 'proto/events/v1';
import * as PeerPB from 'proto/peers/v1';
import * as z from 'zod/mini';

import { logger } from '~/db/client';
import { parseDbRowsInPlace } from '~/db/utils';
import { type TValidEvent, validEventSchema } from '~/queries/mutations';
import { account } from '~/signals/account';
import { uniqueBy } from '~/utils/array';
import { decrypt, encrypt } from '~/workers/encryption';

import type { TTransport } from './transports';

type EventRow = { data: unknown; timestamp: string; type: string; version: string };

export class ConnectionManager {
  readonly accountId: string;
  readonly clientId: string;

  #initialized: boolean = false;
  private pendingDigestUpdates = 0;
  private sendEventsBatch: Batcher<EventRow>;
  private sendTimestampBatch: Batcher<string>;
  private readonly transport: TTransport;

  private unsubscribe: () => void;

  constructor(accountId: string, clientId: string, transport: TTransport) {
    this.accountId = accountId;
    this.clientId = clientId;
    this.transport = transport;
    this.unsubscribe = this.transport.onMessage((data) => this.handleMessage(data));

    this.sendTimestampBatch = new Batcher(
      (timestamps) => void this.flushSendTimestamp(timestamps),
      { maxSize: 100, wait: 5000 }
    );
    this.sendEventsBatch = new Batcher<EventRow>((events) => void this.flushSendEvents(events), {
      maxSize: 100,
      wait: 2000
    });
  }

  addPendingDigestUpdates(n: number) {
    this.pendingDigestUpdates += n;
  }

  addSendTimestamps(timestamps: string[]) {
    if (timestamps.length === 0) return;
    for (const timestamp of timestamps) this.sendTimestampBatch.addItem(timestamp);
    if (this.pendingDigestUpdatesDone()) this.sendTimestampBatch.flush();
  }

  close() {
    this.sendTimestampBatch.cancel();
    this.sendEventsBatch.cancel();
    this.transport.close();
    this.unsubscribe();
  }

  createDigestQuery(merkleDepth: number, paths: number[][]) {
    return toBinary(
      PeerPB.PeerMessageSchema,
      create(PeerPB.PeerMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        message: {
          payload: {
            case: 'eventReconciliation',
            value: {
              message: {
                case: 'digestQueries',
                value: {
                  merkleDepth,
                  queries: paths.map((path) => create(PeerPB.DigestQuerySchema, { path }))
                }
              }
            }
          }
        }
      })
    );
  }

  createDigestUpdate(
    maxDepth: number,
    result: { digest: Uint8Array; path: number[]; timestamp: string }[]
  ) {
    return toBinary(
      PeerPB.PeerMessageSchema,
      create(PeerPB.PeerMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        message: {
          payload: {
            case: 'eventReconciliation',
            value: {
              message: {
                case: 'digestUpdates',
                value: {
                  merkleDepth: maxDepth,
                  updates: result.map((update) => create(PeerPB.DigestUpdateSchema, update))
                }
              }
            }
          }
        }
      })
    );
  }

  createEventBatch(events: PeerPB.Event[]) {
    return toBinary(
      PeerPB.PeerMessageSchema,
      create(PeerPB.PeerMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        message: {
          payload: {
            case: 'eventReconciliation',
            value: {
              message: {
                case: 'events',
                value: { events }
              }
            }
          }
        }
      })
    );
  }

  createHandshake() {
    return toBinary(
      PeerPB.PeerMessageSchema,
      create(PeerPB.PeerMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        message: {
          payload: {
            case: 'handshake',
            value: {
              capabilities: {
                broadcast: true,
                eventReconciliation: true
              }
            }
          }
        }
      })
    );
  }

  createSendEventsWithTimestamp(timestamp: string) {
    return toBinary(
      PeerPB.PeerMessageSchema,
      create(PeerPB.PeerMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        message: {
          payload: {
            case: 'eventReconciliation',
            value: {
              message: {
                case: 'sendEventsAfterTimestamp',
                value: { timestamp }
              }
            }
          }
        }
      })
    );
  }

  createSubscribe(topic: string) {
    return toBinary(
      PeerPB.PeerMessageSchema,
      create(PeerPB.PeerMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        message: {
          payload: {
            case: 'broadcastMessage',
            value: {
              message: {
                case: 'subscribe',
                value: { topic }
              }
            }
          }
        }
      })
    );
  }

  async flushSendEvents(events: EventRow[]) {
    if (!this.transport.ready) return;
    const aesKey = await getAesKey();
    const wallet = getWallet();
    const processedEvents = await Promise.all(
      uniqueBy(events, 'timestamp').map(async ({ data, timestamp, type, version }) => {
        const serializedEvent = toBinary(
          EventPB.EventSchema,
          create(EventPB.EventSchema, {
            data: create(EventPB.EventDataSchema, {
              eventType: { case: type as never, value: data as never }
            }),
            version
          })
        );
        const encryptedEvent = await encrypt(serializedEvent, aesKey);
        const signature = await wallet.signMessage(encryptedEvent);
        return { data: encryptedEvent, signature, timestamp };
      })
    );
    this.write(
      this.createEventBatch(processedEvents.map((event) => create(PeerPB.EventSchema, event)))
    );
  }

  async flushSendTimestamp(timestamps: string[]) {
    const unique = [...new Set(timestamps)];
    if (unique.length === 0) return;
    const sql = `SELECT "data", "timestamp", "type", "version" FROM "events" WHERE "timestamp" IN (${unique.map(() => '?').join(',')})`;

    const events = await parseDbRowsInPlace(logger.db.query<EventRow>({ params: unique, sql }), {
      jsonKeys: ['data']
    });
    await this.flushSendEvents(events);
  }

  async handleEventReconciliation(message: PeerPB.EventReconciliationMessage) {
    const payload = message.message;
    switch (payload.case) {
      case 'digestQueries':
        {
          const { merkleDepth, queries } = payload.value;
          const tree = await logger.getMerkleTree();
          const result = new Array<{
            digest: Uint8Array;
            path: number[];
            timestamp: string;
          }>();
          for (const { path } of queries) {
            const [digest, timestamp] = resolveDigest(tree, merkleDepth, path);
            result.push({ digest, path, timestamp });
          }
          console.debug(`[Sending Message][${this.transport.id}] digestUpdates`, { result });
          this.write(this.createDigestUpdate(tree.maxDepth, result));
        }
        break;
      case 'digestUpdates': {
        const { merkleDepth, updates } = payload.value;
        const tree = await logger.getMerkleTree();
        this.subPendingDigestUpdates(updates.length);
        const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
        let lastTimestamp = '';
        for (const update of updates) {
          const [digest] = resolveDigest(tree, merkleDepth, update.path);
          const mismatch = digestsDiffer(digest, update.digest);

          if (!mismatch) {
            lastTimestamp = update.timestamp;
            continue;
          }

          const isLeafNode = update.path.length === MAX_DEPTH;

          if (!isLeafNode) {
            const paths = Array.from({ length: tree.arity }).map((_, i) => [...update.path, i]);
            this.addPendingDigestUpdates(paths.length);
            this.write(this.createDigestQuery(tree.maxDepth, paths));
            break;
          }

          this.write(this.createSendEventsWithTimestamp(lastTimestamp));
          void this.sendAfterTimestamp(lastTimestamp);
          break;
        }
        break;
      }
      case 'events': {
        const aesKey = await getAesKey();
        const decryptedEvents = await Promise.all(
          payload.value.events.map(async ({ data, timestamp }) => {
            const decryptedEvent = await decrypt(data, aesKey);
            const deserialzedEvent = fromBinary(EventPB.EventSchema, decryptedEvent);
            const parsedEvent = z
              .object({
                data: z.unknown(),
                timestamp: z.string(),
                type: z.string(),
                version: z.string()
              })
              .check(
                z.refine(
                  (value) => {
                    return validEventSchema.safeParse({
                      data: value.data,
                      type: value.type
                    }).success;
                  },
                  {
                    error: 'Invalid event'
                  }
                )
              )
              .parse({
                data: deserialzedEvent.data!.eventType.value!,
                timestamp,
                type: deserialzedEvent.data!.eventType.case!,
                version: deserialzedEvent.version
              }) as TValidEvent & { timestamp: string; version: string };
            return parsedEvent;
          })
        );
        const invalidate = await logger.receive(decryptedEvents);
        await invalidate();
        break;
      }
      case 'sendEventsAfterTimestamp': {
        void this.sendAfterTimestamp(payload.value.timestamp);
        break;
      }
      default:
        console.error('Unknown message type', payload.case);
    }
  }
  async handleMessage(data: Uint8Array<ArrayBuffer>) {
    const body = fromBinary(PeerPB.PeerMessageSchema, data);
    const { clientId, message } = body;
    if (!clientId) return;
    if (!message) return;
    const { payload } = message;
    console.debug(`[Received Message][${this.transport.id}]`, payload.case, payload.value);
    switch (payload.case) {
      case 'eventReconciliation':
        return this.handleEventReconciliation(payload.value);
      case 'handshake': {
        const { capabilities } = payload.value;

        if (capabilities?.broadcast) {
          console.debug(`[Sending Message][${this.transport.id}] subscribe`, { topic: 'events' });
          this.write(this.createSubscribe('events'));
        }

        if (capabilities?.eventReconciliation) {
          const shouldQuery = this.clientId > clientId;
          if (!shouldQuery) return;
          const tree = await logger.getMerkleTree();
          this.addPendingDigestUpdates(1);
          this.write(this.createDigestQuery(tree.maxDepth, [[]]));
        }
        break;
      }
      default: {
        console.error('Unknown message type', payload.case);
      }
    }
  }

  async init() {
    this.write(this.createHandshake());

    if (this.#initialized) return;
    this.#initialized = true;

    logger.on(
      '*',
      (data, timestamp, version, type) =>
        void this.sendEventsBatch.addItem({ data, timestamp, type, version }),
      { remote: false, self: true }
    );
  }

  async sendAfterTimestamp(timestamp: string) {
    let pageSize = 100;
    let cursor = timestamp;
    let hasMore = false;
    do {
      const rows = await logger.db.query<{ timestamp: string }>(
        logger.sql`SELECT timestamp from events WHERE timestamp > ${cursor} ORDER BY timestamp ASC LIMIT ${pageSize + 1}`
      );
      const timestamps = rows.map((row) => row.timestamp);
      hasMore = timestamps.length > pageSize;
      if (hasMore) timestamps.pop();
      cursor = timestamps[timestamps.length - 1];
      this.addSendTimestamps(timestamps);
    } while (hasMore);
  }

  subPendingDigestUpdates(n: number) {
    this.pendingDigestUpdates -= n;
  }

  write(data: Uint8Array<ArrayBuffer>) {
    if (!this.transport.ready) return;
    this.transport.send(data);
  }

  private pendingDigestUpdatesDone() {
    return this.pendingDigestUpdates === 0;
  }
}

function digestsDiffer(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
}

function getAesKey() {
  const $account = account();
  if ($account === null) throw new Error('No account');
  return window.crypto.subtle.importKey('jwk', $account.aesKey, { name: 'AES-GCM' }, true, [
    'encrypt',
    'decrypt'
  ]);
}

function getWallet() {
  const $account = account();
  if ($account === null) throw new Error('No account');
  return new ethers.Wallet($account.privateKey);
}

function isVirtualPath(segments: number[], prefixLen: number): boolean {
  if (segments.length < prefixLen) {
    return true;
  }
  for (let i = 0; i < prefixLen; i++) {
    if (segments[i] != 0) {
      return true;
    }
  }
  return false;
}

function resolveDigest(
  tree: MerkleTree<string, string>,
  merkleDepth: number,
  segments: number[]
): [Uint8Array, string] {
  let maxDepth = merkleDepth;
  if (tree.maxDepth > maxDepth) {
    maxDepth = tree.maxDepth;
  }
  const prefixLen = maxDepth - tree.maxDepth;
  if (tree.isEmpty() || isVirtualPath(segments, prefixLen)) {
    return [new Uint8Array(0), ''];
  }
  const path = segments.slice(prefixLen);
  const digest = tree.getHash(path);
  if (digest === null) {
    return [new Uint8Array(0), ''];
  }
  const timestamp = tree.getMetaByPath(path);
  return [digest, timestamp ?? ''];
}
