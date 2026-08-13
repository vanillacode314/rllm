import type { MerkleTree } from 'event-logger';

import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { makeReconnectingWS } from '@solid-primitives/websocket';
import { Batcher } from '@tanstack/solid-pacer';
import { inArray } from 'drizzle-orm';
import { ethers } from 'ethers';
import * as EventPB from 'proto/events/v1/event_pb';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import { createComputed, createMemo, untrack } from 'solid-js';
import { AsyncResult, Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import { db, logger } from '~/db/client';
import { tables } from '~/db/schema';
import { type TValidEvent, validEventSchema } from '~/queries/mutations';
import { account } from '~/signals/account';
import { env } from '~/utils/env';
import { isOnline } from '~/utils/signals';
import { decrypt, encrypt } from '~/workers/encryption';

const shouldPoll = createMemo(
  () => isOnline() && account() !== null && env.VITE_SYNC_SERVER_BASE_URL !== undefined
);

let connection: ConnectionManager | undefined;

type EventRow = { data: unknown; timestamp: string; type: string; version: string };

class ConnectionManager {
  readonly accountId: string;
  readonly clientId: string;
  readonly ws: WebSocket;

  private askTimestampBatch: Batcher<string>;
  private hasQueryBatch: Batcher<string>;
  private pendingDigestUpdates = 0;
  private sendEventsBatch: Batcher<EventRow>;
  private sendTimestampBatch: Batcher<string>;

  constructor(accountId: string, clientId: string, ws: WebSocket) {
    this.accountId = accountId;
    this.clientId = clientId;
    this.ws = ws;

    this.sendTimestampBatch = new Batcher<string>(
      (timestamps) => void this.flushSendTimestamp(timestamps),
      { maxSize: 30, wait: 5000 }
    );
    this.askTimestampBatch = new Batcher<string>(
      (timestamps) => void this.flushSendEventWithTimestamp(timestamps),
      { maxSize: 100, wait: 5000 }
    );
    this.hasQueryBatch = new Batcher<string>(
      (timestamps) => void this.flushHasEventQuery(timestamps),
      { maxSize: 100, wait: 5000 }
    );
    this.sendEventsBatch = new Batcher<EventRow>((events) => void this.flushSendEvents(events), {
      maxSize: 30,
      wait: 2000
    });
  }

  addAskTimestamps(timestamps: string[]) {
    if (timestamps.length === 0) return;
    for (const timestamp of timestamps) this.askTimestampBatch.addItem(timestamp);
    if (this.pendingDigestUpdatesDone()) this.askTimestampBatch.flush();
  }

  addHasEventQuery(timestamps: string[]) {
    if (timestamps.length === 0) return;
    for (const timestamp of timestamps) this.hasQueryBatch.addItem(timestamp);
    if (this.pendingDigestUpdatesDone()) this.hasQueryBatch.flush();
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
    this.askTimestampBatch.cancel();
    this.hasQueryBatch.cancel();
    this.sendEventsBatch.cancel();
  }

  createDigestQuery(merkleDepth: number, paths: number[][]) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: {
          case: 'digestQuery',
          value: {
            merkleDepth,
            paths: paths.map((path) => create(PeerPB.TreePathSchema, { segments: path }))
          }
        }
      })
    );
  }

  createEventBatch(events: PeerPB.PeerEvent[]) {
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

  createHasEventWithTimestampQuery(timestamps: string[]) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: { case: 'hasEventWithTimestampQuery', value: { timestamps } }
      })
    );
  }

  createHasEventWithTimestampUpdates(updates: PeerPB.HasEventWithTimestampUpdate[]) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: { case: 'hasEventWithTimestampUpdates', value: { updates } }
      })
    );
  }

  createSendEventWithTimestamp(timestamps: string[]) {
    return toBinary(
      PeerPB.SyncWireMessageSchema,
      create(PeerPB.SyncWireMessageSchema, {
        accountId: this.accountId,
        clientId: this.clientId,
        payload: { case: 'sendEventWithTimestamp', value: { timestamps } }
      })
    );
  }

  flushHasEventQuery(timestamps: string[]) {
    console.debug('[WS Sending Message] hasEventWithTimestampQuery', { timestamps });
    this.write(this.createHasEventWithTimestampQuery([...new Set(timestamps)]));
  }

  async flushHasEventUpdate(timestamps: string[]) {
    const tree = await logger.getMerkleTree();
    const updates = timestamps.map((timestamp) =>
      create(PeerPB.HasEventWithTimestampUpdateSchema, {
        timestamp,
        yes: tree.getIndexByMeta(timestamp, (a, b) => (a === b ? 0 : a < b ? -1 : 1)) > -1
      })
    );
    console.debug('[WS Sending Message] hasEventWithTimestampUpdates', { updates });
    this.write(this.createHasEventWithTimestampUpdates(updates));
  }

  async flushSendEvents(events: EventRow[]) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    const aesKey = await getAesKey();
    const wallet = getWallet();
    console.debug('[WS Push] Sending', events.length, 'events');
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
      this.createEventBatch(processedEvents.map((event) => create(PeerPB.PeerEventSchema, event)))
    );
  }

  flushSendEventWithTimestamp(timestamps: string[]) {
    console.debug('[WS Sending Message] sendEventWithTimestamp', { timestamps });
    this.write(this.createSendEventWithTimestamp([...new Set(timestamps)]));
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

  init() {
    logger.on(
      '*',
      (data, timestamp, version, type) =>
        void this.sendEventsBatch.addItem({ data, timestamp, type, version }),
      { remote: false, self: true }
    );
  }

  subPendingDigestUpdates(n: number) {
    this.pendingDigestUpdates -= n;
  }

  write(data: Uint8Array<ArrayBuffer>) {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(data);
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

function handleMessage(connection: ConnectionManager, event: MessageEvent) {
  return AsyncResult.from(
    async function () {
      const body = fromBinary(
        PeerPB.SyncWireMessageSchema,
        new Uint8Array(await event.data.arrayBuffer())
      );
      const { payload } = body;
      console.debug('[WS Received Message]', payload.case, payload.value);
      switch (payload.case) {
        case 'digestQuery': {
          const { merkleDepth, paths } = payload.value;
          const tree = await logger.getMerkleTree();
          const result = new Array<{
            digest: Uint8Array;
            path: number[];
            timestamp: string;
          }>();
          for (const { segments } of paths) {
            const [digest, timestamp] = resolveDigest(tree, merkleDepth, segments);
            result.push({ digest, path: segments, timestamp });
          }
          console.debug('[WS Sending Message] digestUpdate', { result });
          connection.write(
            toBinary(
              PeerPB.SyncWireMessageSchema,
              create(PeerPB.SyncWireMessageSchema, {
                accountId: connection.accountId,
                clientId: connection.clientId,
                payload: {
                  case: 'digestUpdate',
                  value: {
                    digests: result.map((value) => create(PeerPB.DigestWithPathSchema, value)),
                    merkleDepth: tree.maxDepth
                  }
                }
              })
            )
          );
          break;
        }
        case 'digestUpdate': {
          const { digests, merkleDepth } = payload.value;
          const tree = await logger.getMerkleTree();
          connection.subPendingDigestUpdates(digests.length);
          const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
          const timestampsToAsk = [] as string[];
          const timestampsToSend = [] as string[];
          const timestampsToQuery = [] as string[];
          for (const { digest: theirDigest, path, timestamp: theirTimestamp } of digests) {
            const [ourDigest] = resolveDigest(tree, merkleDepth, path);
            const mismatch = digestsDiffer(ourDigest, theirDigest);

            if (!mismatch) continue;

            const isLeafNode = path.length === MAX_DEPTH;
            if (isLeafNode) {
              if (isZeroDigest(ourDigest)) {
                timestampsToAsk.push(theirTimestamp);
                continue;
              }
              const timestamp = tree.getMetaByPath(path.slice(MAX_DEPTH - tree.maxDepth));
              if (timestamp === null) {
                console.error(
                  'data integrity error: timestamp missing in our tree for path',
                  path.slice(MAX_DEPTH - tree.maxDepth)
                );
                continue;
              }
              if (isZeroDigest(theirDigest)) {
                timestampsToSend.push(timestamp);
                continue;
              }
              timestampsToQuery.push(timestamp);
            } else {
              const paths = Array.from({ length: tree.arity }).map((_, i) => [...path, i]);
              connection.addPendingDigestUpdates(paths.length);
              connection.write(connection.createDigestQuery(tree.maxDepth, paths));
            }
          }
          connection.addAskTimestamps(timestampsToAsk);
          connection.addSendTimestamps(timestampsToSend);
          connection.addHasEventQuery(timestampsToQuery);
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
          console.debug(`[WS Pull] Got ${payload.value.events.length} events`);
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
          const shouldQuery = connection.clientId > payload.value.clientId;
          const ourRootDigest = tree.getRootHash();
          const mismatch = digestsDiffer(ourRootDigest, payload.value.rootDigest);
          if (!mismatch) console.debug('[WS Handshake] Roots match');
          if (!shouldQuery) return;

          if (mismatch) {
            const paths = Array.from({ length: tree.arity }).map((_, i) => [i]);
            connection.addPendingDigestUpdates(paths.length);
            connection.write(connection.createDigestQuery(tree.maxDepth, paths));
          }
          break;
        }
        case 'hasEventWithTimestampQuery': {
          const { timestamps } = payload.value;
          await connection.flushHasEventUpdate(timestamps);
          break;
        }
        case 'hasEventWithTimestampUpdates': {
          const { updates } = payload.value;
          const timestamps = [] as string[];
          for (const { timestamp, yes } of updates) {
            if (!yes) timestamps.push(timestamp);
          }
          connection.addSendTimestamps(timestamps);
          break;
        }
        case 'sendEventWithTimestamp': {
          const { timestamps } = payload.value;
          connection.addSendTimestamps(timestamps);
          break;
        }
      }
    },
    (e) => new Error(`Error while handling websocket message`, { cause: e })
  );
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

function isZeroDigest(digest: Uint8Array) {
  return digest.length === 0;
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

const initSocket = () =>
  tryBlock(
    async function* () {
      const clientId = yield* Option.from(await logger.getMetadata('clientId')).okOrElse(
        () => new Error('Missing clientId in local database metadata')
      );

      const setupWs = () =>
        AsyncResult.from(
          async function () {
            const $account = account();
            if ($account === null) return;
            if (connection && connection.ws.readyState < 2) return;

            const socketUrl = new URL(env.VITE_SYNC_SERVER_BASE_URL!);
            socketUrl.protocol = socketUrl.protocol.replace('http', 'ws');
            socketUrl.pathname = '/api/v1/ws';
            socketUrl.searchParams.set('clientId', clientId);
            socketUrl.searchParams.set('accountId', $account.id);

            const ws = makeReconnectingWS(socketUrl.toString());
            const manager = new ConnectionManager($account.id, clientId, ws);
            connection = manager;
            manager.init();

            ws.addEventListener('open', async () => {
              const version = await logger.getVersion();
              const tree = await logger.getMerkleTree();
              const rootDigest = tree.getHash([]);
              if (rootDigest === null) {
                throw new Error('Unreachable: root digest is always defined');
              }
              manager.write(manager.createHandshake(version ?? '0', rootDigest));
              console.debug('[WS] Connected');
            });

            ws.addEventListener('message', (e) => void handleMessage(manager, e).unwrap());
          },
          (e) => new Error(`Error while setting up websocket`, { cause: e })
        );

      createComputed(() => {
        const $shouldPoll = shouldPoll();
        untrack(() => {
          if (!$shouldPoll) {
            console.debug('[WS] Offline');
            connection?.close();
            if (connection && connection.ws.readyState < 2) connection.ws.close();
            return;
          }
          console.debug('[WS] Online');
          setupWs().unwrap();
        });
      });
    },
    (e) => new Error(`Error while initializing websocket`, { cause: e })
  );

export { ConnectionManager, initSocket };
