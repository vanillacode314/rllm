import type { MerkleTree } from 'event-logger';

import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { makeReconnectingWS } from '@solid-primitives/websocket';
import { asyncBatch } from '@tanstack/solid-pacer';
import { inArray } from 'drizzle-orm';
import { ethers } from 'ethers';
import * as EventPB from 'proto/events/v1/event_pb';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import { createComputed, createMemo, untrack } from 'solid-js';
import { AsyncResult, Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import type { TEvent } from '~/db/events-schema';

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
let ws: WebSocket;

const ZERO_DIGEST = new Uint8Array(0);

function createDigestQuery(
  accountId: string,
  clientId: string,
  merkleDepth: number,
  paths: number[][]
) {
  return toBinary(
    PeerPB.SyncWireMessageSchema,
    create(PeerPB.SyncWireMessageSchema, {
      accountId,
      clientId,
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

function createEventBatch(accountId: string, clientId: string, events: PeerPB.PeerEvent[]) {
  return toBinary(
    PeerPB.SyncWireMessageSchema,
    create(PeerPB.SyncWireMessageSchema, {
      accountId,
      clientId,
      payload: {
        case: 'eventBatch',
        value: { events }
      }
    })
  );
}

function isZeroDigest(digest: Uint8Array) {
  return (
    digest.length === ZERO_DIGEST.length &&
    digest.every((value, index) => value === ZERO_DIGEST[index])
  );
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
            setupMessageStream();
            if (ws && ws.readyState < 2) return;
            const $account = account();
            if ($account === null) return;
            const socketUrl = new URL(env.VITE_SYNC_SERVER_BASE_URL!);
            socketUrl.protocol = socketUrl.protocol.replace('http', 'ws');
            socketUrl.pathname = '/api/v1/ws';
            socketUrl.searchParams.set('clientId', clientId);
            socketUrl.searchParams.set('accountId', account()!.id);
            ws = makeReconnectingWS(socketUrl.toString());
            ws.addEventListener('open', async () => {
              const version = await logger.getVersion();
              const tree = await logger.getMerkleTree();
              const rootDigest = tree.getHash([]);
              if (rootDigest === null) {
                throw new Error('Unreachable: root digest is always defined');
              }
              ws.send(
                toBinary(
                  PeerPB.SyncWireMessageSchema,
                  create(PeerPB.SyncWireMessageSchema, {
                    accountId: $account.id,
                    clientId,
                    payload: {
                      case: 'handshake',
                      value: create(PeerPB.SyncHandshakeSchema, {
                        clientId,
                        rootDigest,
                        version: version ?? '0'
                      })
                    }
                  })
                )
              );
              console.debug('[WS] Connected');
            });

            const batchHasEventWithTimestampQuery = asyncBatch<string>(
              async (timestamps) => {
                ws.send(
                  toBinary(
                    PeerPB.SyncWireMessageSchema,
                    create(PeerPB.SyncWireMessageSchema, {
                      accountId: $account.id,
                      clientId,
                      payload: {
                        case: 'hasEventWithTimestampQuery',
                        value: { timestamps }
                      }
                    })
                  )
                );
              },
              { maxSize: 100, wait: 5000 }
            );

            const batchSendEventWithTimestamp = asyncBatch<string>(
              async (timestamps) => {
                ws.send(
                  toBinary(
                    PeerPB.SyncWireMessageSchema,
                    create(PeerPB.SyncWireMessageSchema, {
                      accountId: $account.id,
                      clientId,
                      payload: {
                        case: 'sendEventWithTimestamp',
                        value: { timestamps }
                      }
                    })
                  )
                );
              },
              { maxSize: 100, wait: 5000 }
            );
            const batchHasEventWithTimestampUpdate = asyncBatch<string>(
              async (timestamps) => {
                const tree = await logger.getMerkleTree();
                ws.send(
                  toBinary(
                    PeerPB.SyncWireMessageSchema,
                    create(PeerPB.SyncWireMessageSchema, {
                      accountId: $account.id,
                      clientId,
                      payload: {
                        case: 'hasEventWithTimestampUpdates',
                        value: {
                          updates: timestamps.map((timestamp) =>
                            create(PeerPB.HasEventWithTimestampUpdateSchema, {
                              timestamp,
                              yes:
                                tree.getIndexByMeta(timestamp, (a, b) =>
                                  a === b ? 0 : a < b ? -1 : 1
                                ) > -1
                            })
                          )
                        }
                      }
                    })
                  )
                );
              },
              { maxSize: 100, wait: 5000 }
            );
            const batchTimestampForSending = asyncBatch<string>(
              async (timestamps) => {
                const events = await db
                  .select({
                    data: tables.events.data,
                    timestamp: tables.events.timestamp,
                    type: tables.events.type,
                    version: tables.events.version
                  })
                  .from(tables.events)
                  .where(inArray(tables.events.timestamp, timestamps));

                console.debug('[WS Push] Found', events.length, 'events to push');
                const aesKey = await getAesKey();
                const wallet = getWallet();
                const processedEvents = await Promise.all(
                  events.map(async ({ data, timestamp, type, version }) => {
                    const serializedEvent = toBinary(
                      EventPB.EventSchema,
                      create(EventPB.EventSchema, {
                        data: {
                          eventType: {
                            case: type as never,
                            value: data as never
                          }
                        },
                        version: version ?? '0'
                      })
                    );
                    const encryptedEvent = await encrypt(serializedEvent, aesKey);
                    const signature = await wallet.signMessage(encryptedEvent);
                    return { data: encryptedEvent, signature, timestamp };
                  })
                );
                ws.send(
                  createEventBatch(
                    $account.id,
                    clientId,
                    processedEvents.map((event) => create(PeerPB.PeerEventSchema, event))
                  )
                );
              },
              { maxSize: 30, wait: 5000 }
            );

            const onMessage = (event: MessageEvent) =>
              AsyncResult.from(
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
                      ws.send(
                        toBinary(
                          PeerPB.SyncWireMessageSchema,
                          create(PeerPB.SyncWireMessageSchema, {
                            accountId: $account.id,
                            clientId,
                            payload: {
                              case: 'digestUpdate',
                              value: {
                                digests: result.map((value) =>
                                  create(PeerPB.DigestWithPathSchema, value)
                                ),
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
                      const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
                      for (const {
                        digest: theirDigest,
                        path,
                        timestamp: theirTimestamp
                      } of digests) {
                        const [ourDigest] = resolveDigest(tree, merkleDepth, path);
                        const mismatch = digestsDiffer(ourDigest, theirDigest);

                        if (!mismatch) continue;

                        const isLeafNode = path.length === MAX_DEPTH;
                        if (isLeafNode) {
                          if (isZeroDigest(ourDigest)) {
                            batchSendEventWithTimestamp(theirTimestamp);
                            continue;
                          }
                          const timestamp = tree.getMetaByPath(
                            path.slice(MAX_DEPTH - tree.maxDepth)
                          );
                          if (timestamp === null) {
                            console.error(
                              'data integrity error: timestamp missing in our tree for path',
                              path.slice(MAX_DEPTH - tree.maxDepth)
                            );
                            continue;
                          }
                          if (isZeroDigest(theirDigest)) {
                            batchTimestampForSending(timestamp);
                            continue;
                          }
                          batchHasEventWithTimestampQuery(timestamp);
                        } else {
                          ws.send(
                            createDigestQuery(
                              $account.id,
                              clientId,
                              tree.maxDepth,
                              Array.from({ length: tree.arity }).map((_, i) => [...path, i])
                            )
                          );
                        }
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
                      const shouldQuery = clientId > payload.value.clientId;
                      const ourRootDigest = tree.getRootHash();
                      const mismatch = digestsDiffer(ourRootDigest, payload.value.rootDigest);
                      if (!mismatch) console.log('[WS Handshake] Roots match');
                      if (!shouldQuery) return;

                      if (mismatch)
                        ws.send(
                          createDigestQuery(
                            $account.id,
                            clientId,
                            tree.maxDepth,
                            Array.from({ length: tree.arity }).map((_, i) => [i])
                          )
                        );
                      break;
                    }
                    case 'hasEventWithTimestampQuery': {
                      const { timestamps } = payload.value;
                      for (const timestamp of timestamps)
                        batchHasEventWithTimestampUpdate(timestamp);
                      break;
                    }
                    case 'hasEventWithTimestampUpdates': {
                      const { updates } = payload.value;
                      for (const { timestamp, yes } of updates) {
                        if (!yes) batchTimestampForSending(timestamp);
                      }
                      break;
                    }
                    case 'sendEventWithTimestamp': {
                      const { timestamps } = payload.value;
                      for (const timestamp of timestamps) batchTimestampForSending(timestamp);
                      break;
                    }
                  }
                },
                (e) => new Error(`Error while handling websocket message`, { cause: e })
              );
            ws.addEventListener('message', (e) => onMessage(e).unwrap());
          },
          (e) => new Error(`Error while setting up websocket`, { cause: e })
        );
      createComputed(() => {
        const $shouldPoll = shouldPoll();
        untrack(() => {
          if (!$shouldPoll) {
            console.debug('[WS] Offline');

            if (ws && ws.readyState < 2) ws.close();

            return;
          }
          console.debug('[WS] Online');
          setupWs().unwrap();
        });
      });
    },
    (e) => new Error(`Error while initializing websocket`, { cause: e })
  );

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

const batchEventToSend = asyncBatch<{ event: TEvent; timestamp: string; version: string }>(
  async (events) => {
    const $account = account();
    if ($account === null) return;
    const clientId = Option.from(await logger.getMetadata('clientId'))
      .okOrElse(() => new Error('Missing clientId in local database metadata'))
      .unwrap();
    const aesKey = await getAesKey();
    const wallet = getWallet();
    if (!ws) return;
    if (ws.readyState !== 1) return;
    console.debug('[WS Push] Found', events.length, 'events to push');
    const processedEvents = await Promise.all(
      events.map(async ({ event, timestamp, version }) => {
        const serializedEvent = toBinary(
          EventPB.EventSchema,
          create(EventPB.EventSchema, {
            data: {
              eventType: {
                case: event.type as never,
                value: event.data as never
              }
            },
            version
          })
        );
        const encryptedEvent = await encrypt(serializedEvent, aesKey);
        const signature = await wallet.signMessage(encryptedEvent);
        return { data: encryptedEvent, signature, timestamp };
      })
    );
    ws.send(
      createEventBatch(
        $account.id,
        clientId,
        processedEvents.map((event) => create(PeerPB.PeerEventSchema, event))
      )
    );
  },
  {
    maxSize: 30,
    wait: 2000
  }
);
const setupMessageStream = () => {
  logger.on(
    '*',
    (data, timestamp, version, type) =>
      void batchEventToSend({ event: { data, type } as TEvent, timestamp, version }),
    { remote: false, self: true }
  );
};
export { initSocket };

function digestsDiffer(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return true;
  }
  return false;
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
