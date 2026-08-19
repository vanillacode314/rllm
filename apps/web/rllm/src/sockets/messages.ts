import type { MerkleTree } from 'event-logger';

import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { Batcher } from '@tanstack/solid-pacer';
import { inArray } from 'drizzle-orm';
import { ethers } from 'ethers';
import * as EventPB from 'proto/events/v1/event_pb';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import * as z from 'zod/mini';

import { db, logger } from '~/db/client';
import { tables } from '~/db/schema';
import { type TValidEvent, validEventSchema } from '~/queries/mutations';
import { account } from '~/signals/account';
import { decrypt, encrypt } from '~/workers/encryption';

import type { TTransport } from './transports';

type EventRow = { data: unknown; timestamp: string; type: string; version: string };

export class ConnectionManager {
  readonly accountId: string;
  readonly clientId: string;

  private pendingDigestUpdates = 0;
  private sendEventsBatch: Batcher<EventRow>;
  private sendTimestampBatch: Batcher<string>;
  private readonly transport: TTransport;

  private unsubscribe: () => void;

  constructor(accountId: string, clientId: string, transport: TTransport) {
    this.accountId = accountId;
    this.clientId = clientId;
    this.transport = transport;
    this.unsubscribe = this.transport.onmessage((data) => this.handleMessage(data));

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
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: {
          case: 'digestQueries',
          value: {
            merkleDepth,
            queries: paths.map((path) => create(PeerPB.DigestQuerySchema, { path }))
          }
        }
      })
    );
  }

  createEventBatch(events: PeerPB.EventBatchPayload[]) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: { case: 'eventBatch', value: { events } }
      })
    );
  }

  createHandshake(version: string, rootDigest: Uint8Array) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: {
          case: 'handshake',
          value: create(PeerPB.SyncHandshakeSchema, {
            clientId: this.clientId,
            rootDigest,
            version
          })
        }
      })
    );
  }

  createSendEventsWithTimestamp(timestamp: string) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: { case: 'sendEventsAfterTimestamp', value: { timestamp } }
      })
    );
  }

  createWebRTCSignal(to: string, data: object) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: {
          case: 'webrtcSignal',
          value: { data: JSON.stringify(data), to }
        }
      })
    );
  }

  async flushSendEvents(events: EventRow[]) {
    if (!this.transport.ready) return;
    const aesKey = await getAesKey();
    const wallet = getWallet();
    const processedEvents = await Promise.all(
      events.map(async ({ data, timestamp, type, version }) => {
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
      this.createEventBatch(
        processedEvents.map((event) => create(PeerPB.EventBatchPayloadSchema, event))
      )
    );
  }

  async flushSendTimestamp(timestamps: string[]) {
    const unique = [...new Set(timestamps)];
    if (unique.length === 0) return;
    const events = await db
      .select({
        data: tables.events.data,
        timestamp: tables.events.timestamp,
        type: tables.events.type,
        version: tables.events.version
      })
      .from(tables.events)
      .where(inArray(tables.events.timestamp, unique));
    await this.flushSendEvents(events);
  }

  async handleMessage(data: Uint8Array<ArrayBuffer>) {
    const SUPPORTED_EVENTS = [
      'digestQueries',
      'digestUpdates',
      'eventBatch',
      'handshake',
      'sendEventsAfterTimestamp'
    ];
    const body = fromBinary(PeerPB.SyncWireMessageSchema, data);
    const { payload } = body;
    if (!SUPPORTED_EVENTS.includes(payload.case ?? '')) return;
    console.debug(`[Received Message][${this.transport.id}]`, payload.case, payload.value);
    switch (payload.case) {
      case 'digestQueries': {
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
        this.write(
          toBinary(
            PeerPB.SyncWireMessageSchema,
            create(PeerPB.SyncWireMessageSchema, {
              accountId: this.accountId,
              clientId: this.clientId,
              payload: {
                case: 'digestUpdates',
                value: {
                  merkleDepth: tree.maxDepth,
                  updates: result.map((update) => create(PeerPB.DigestUpdateSchema, update))
                }
              }
            })
          )
        );
        break;
      }
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
      case 'eventBatch': {
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
      case 'handshake': {
        if (payload.value.rootDigest === undefined) {
          console.error('Invalid handshake, root digest missing');
          return;
        }
        if (payload.value.clientId === '') {
          console.error('Invalid handshake, clientId missing');
          return;
        }
        const tree = await logger.getMerkleTree();
        const shouldQuery = this.clientId > payload.value.clientId;
        const ourRootDigest = tree.getRootHash();
        const mismatch = digestsDiffer(ourRootDigest, payload.value.rootDigest);
        if (!mismatch) console.debug(`[Handshake][${this.transport.id}] Roots match`);
        if (!shouldQuery) return;

        if (mismatch) {
          const paths = Array.from({ length: tree.arity }).map((_, i) => [i]);
          this.addPendingDigestUpdates(paths.length);
          this.write(this.createDigestQuery(tree.maxDepth, paths));
        }
        break;
      }
      case 'sendEventsAfterTimestamp': {
        void this.sendAfterTimestamp(payload.value.timestamp);
        break;
      }
      default: {
        console.error('Unknown message type', payload.case);
      }
    }
  }

  async init() {
    const version = await logger.getVersion();
    const tree = await logger.getMerkleTree();
    const rootDigest = tree.getHash([]);
    if (rootDigest === null) {
      throw new Error('Unreachable: root digest is always defined');
    }
    this.write(this.createHandshake(version ?? '0', rootDigest));

    logger.on(
      '*',
      (data, timestamp, version, type) =>
        void this.sendEventsBatch.addItem({ data, timestamp, type, version }),
      { remote: false, self: true }
    );
  }

  async sendAfterTimestamp(timestamp: string) {
    let pageSize = 100;
    let cursor = '';
    let hasMore = false;
    do {
      // oxlint-disable-next-line no-await-in-loop
      const rows = await logger.db.query<{ timestamp: string }>(
        logger.sql`
                          SELECT timestamp from events 
                            WHERE timestamp > ${cursor} 
                          AND timestamp > ${timestamp} 
                            ORDER BY timestamp ASC 
                          LIMIT ${pageSize + 1}
                        `
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
