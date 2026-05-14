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
              ws.send(
                toBinary(
                  PeerPB.SyncWireMessageSchema,
                  create(PeerPB.SyncWireMessageSchema, {
                    accountId: $account.id,
                    clientId,
                    payload: {
                      case: 'handshake',
                      value: create(PeerPB.SyncHandshakeSchema, {
                        version: version ?? '0'
                      })
                    }
                  })
                )
              );
              console.debug('[WS] Connected');
            });

            const batchTimestampForSending = asyncBatch<string>(
              async (timestamps) => {
                const events = await db
                  .select({
                    data: tables.events.data,
                    timestamp: tables.events.timestamp,
                    version: tables.events.version,
                    type: tables.events.type
                  })
                  .from(tables.events)
                  .where(inArray(tables.events.timestamp, timestamps));

                console.debug('[WS Push] Found', events.length, 'events to push');
                const aesKey = await getAesKey();
                const wallet = getWallet();
                const processedEvents = await Promise.all(
                  events.map(async ({ data, type, timestamp, version }) => {
                    const serializedEvent = toBinary(
                      EventPB.EventSchema,
                      create(EventPB.EventSchema, {
                        version: version ?? '0',
                        data: {
                          eventType: {
                            case: type as never,
                            value: data as never
                          }
                        }
                      })
                    );
                    const encryptedEvent = await encrypt(serializedEvent, aesKey);
                    const signature = await wallet.signMessage(encryptedEvent);
                    return { signature, timestamp, data: encryptedEvent };
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
                      const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
                      const result = new Array<{ digest: Uint8Array; path: number[] }>();
                      const virtualTreePrefix = Array.from({
                        length: MAX_DEPTH - tree.maxDepth
                      }).fill(0);
                      for (const { segments } of paths) {
                        const isVirtualTree =
                          segments.length < virtualTreePrefix.length ||
                          virtualTreePrefix.some((value, i) => segments[i] !== value);
                        const digest =
                          tree.isEmpty() ? ZERO_DIGEST
                          : isVirtualTree ? ZERO_DIGEST
                          : (tree.getHash(segments.slice(virtualTreePrefix.length)) ?? ZERO_DIGEST);
                        result.push({ digest, path: segments });
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
                                merkleDepth: tree.maxDepth,
                                digests: result.map((value) =>
                                  create(PeerPB.DigestWithPathSchema, value)
                                )
                              }
                            }
                          })
                        )
                      );
                      break;
                    }
                    case 'digestUpdate': {
                      const { merkleDepth, digests } = payload.value;
                      const tree = await logger.getMerkleTree();
                      const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
                      const virtualTreePrefix = Array.from({
                        length: MAX_DEPTH - tree.maxDepth
                      }).fill(0);
                      for (const { digest: theirDigest, path } of digests) {
                        const isVirtualTree =
                          path.length < virtualTreePrefix.length ||
                          virtualTreePrefix.some((value, i) => path[i] !== value);
                        const ourDigest =
                          tree.isEmpty() ? ZERO_DIGEST
                          : isVirtualTree ? ZERO_DIGEST
                          : (tree.getHash(path.slice(virtualTreePrefix.length)) ?? ZERO_DIGEST);

                        const mismatch =
                          theirDigest.length !== ourDigest.length ||
                          theirDigest.some((value, index) => value !== ourDigest[index]);
                        if (path.length - virtualTreePrefix.length === 0 && !mismatch) {
                          console.debug('Roots match');
                        }
                        if (!mismatch) continue;

                        const isLeafNode = path.length === MAX_DEPTH;
                        if (isLeafNode) {
                          if (isZeroDigest(ourDigest)) continue;
                          const timestamp = tree.getMetaByPath(
                            path.slice(virtualTreePrefix.length)
                          );
                          if (timestamp === null) {
                            console.error('data integrity error');
                            continue;
                          }
                          if (isZeroDigest(theirDigest)) {
                            batchTimestampForSending(timestamp);
                            continue;
                          }
                          ws.send(
                            toBinary(
                              PeerPB.SyncWireMessageSchema,
                              create(PeerPB.SyncWireMessageSchema, {
                                accountId: $account.id,
                                clientId,
                                payload: {
                                  case: 'hasEventWithTimestampQuery',
                                  value: { timestamp }
                                }
                              })
                            )
                          );
                        } else {
                          ws.send(
                            createDigestQuery(
                              $account.id,
                              clientId,
                              tree.maxDepth,
                              Array.from({ length: 16 }).map((_, i) => [...path, i])
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
                              type: z.string(),
                              data: z.unknown(),
                              timestamp: z.string(),
                              version: z.string()
                            })
                            .check(
                              z.refine(
                                (value) => {
                                  return validEventSchema.safeParse({
                                    type: value.type,
                                    data: value.data
                                  }).success;
                                },
                                {
                                  error: 'Invalid event'
                                }
                              )
                            )
                            .parse({
                              type: deserialzedEvent.data!.eventType.case!,
                              data: deserialzedEvent.data!.eventType.value!,
                              timestamp,
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
                      console.debug('Handshake done');
                      const tree = await logger.getMerkleTree();
                      ws.send(createDigestQuery($account.id, clientId, tree.maxDepth, [[]]));
                      break;
                    }
                    case 'hasEventWithTimestampQuery': {
                      const { timestamp } = payload.value;
                      const tree = await logger.getMerkleTree();
                      const yes =
                        tree.getIndexByMeta(timestamp, (a, b) =>
                          a === b ? 0
                          : a < b ? -1
                          : 1
                        ) > -1;
                      ws.send(
                        toBinary(
                          PeerPB.SyncWireMessageSchema,
                          create(PeerPB.SyncWireMessageSchema, {
                            accountId: $account.id,
                            clientId,
                            payload: {
                              case: 'hasEventWithTimestampUpdate',
                              value: { timestamp, yes }
                            }
                          })
                        )
                      );
                      break;
                    }
                    case 'hasEventWithTimestampUpdate': {
                      const { timestamp, yes } = payload.value;
                      if (yes) return;
                      batchTimestampForSending(timestamp);
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
            version,
            data: {
              eventType: {
                case: event.type as never,
                value: event.data as never
              }
            }
          })
        );
        const encryptedEvent = await encrypt(serializedEvent, aesKey);
        const signature = await wallet.signMessage(encryptedEvent);
        return { signature, timestamp, data: encryptedEvent };
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
    wait: 2000,
    maxSize: 30
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
