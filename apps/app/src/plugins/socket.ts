import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { asyncBatch } from '@tanstack/pacer';
import { and, eq, inArray } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import * as PeerPB from 'proto/peers/v1/peer_pb';

import { db } from '~/db/client';
import { getMerkleTree, recomputeMerkleTree } from '~/db/merkle-tree';
import { receiveMessage } from '~/db/messages';
import * as schema from '~/db/schema';
import { verifyData } from '~/utils/auth';
import { getLocalClock } from '~/utils/clock';

const ZERO_DIGEST = new Uint8Array(0);

function isZeroDigest(digest: Uint8Array) {
  return (
    digest.length === ZERO_DIGEST.length &&
    digest.every((value, index) => value === ZERO_DIGEST[index])
  );
}
function unique<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}

export const socketPlugin = new Elysia({ serve: { idleTimeout: 120 } }).ws('ws', {
  body: t.Object(
    {
      accountId: t.String(),
      clientId: t.String(),
      payload: t.Union([
        t.Object({
          case: t.Literal('handshake'),
          value: t.Object({ version: t.String() })
        }),
        t.Object({
          case: t.Literal('digestQuery'),
          value: t.Object({
            merkleDepth: t.Integer(),
            paths: t.Array(t.Object({ segments: t.Array(t.Number()) }))
          })
        }),
        t.Object({
          case: t.Literal('digestUpdate'),
          value: t.Object({
            digests: t.Array(
              t.Object({
                digest: t.Uint8Array(),
                path: t.Array(t.Number())
              })
            ),
            merkleDepth: t.Integer()
          })
        }),
        t.Object({
          case: t.Literal('eventBatch'),
          value: t.Object({
            events: t.Array(
              t.Object({
                data: t.Uint8Array(),
                signature: t.String(),
                timestamp: t.String()
              })
            )
          })
        }),
        t.Object({
          case: t.Literal('hasEventWithTimestampQuery'),
          value: t.Object({ timestamp: t.String() })
        }),
        t.Object({
          case: t.Literal('hasEventWithTimestampUpdate'),
          value: t.Object({ timestamp: t.String(), yes: t.Boolean() })
        }),
        t.Object({
          case: t.Undefined(),
          value: t.Undefined()
        })
      ])
    },
    { additionalProperties: true }
  ),

  async message(ws, body) {
    const clock = await getLocalClock();
    const { accountId, payload } = body;
    let version: null | string = null;

    const batchTimestampsToSend = asyncBatch<string>(
      async (timestamps) => {
        timestamps = unique(timestamps);
        const events = await db
          .select({
            data: schema.messages.data,
            signature: schema.messages.signature,
            timestamp: schema.messages.timestamp
          })
          .from(schema.messages)
          .where(
            and(
              eq(schema.messages.accountId, accountId),
              inArray(schema.messages.timestamp, timestamps)
            )
          );
        if (events.length === 0) {
          console.warn('Timestamps requested but events not found', timestamps);
          return;
        }
        ws.sendBinary(
          createEventBatch(events.map((event) => create(PeerPB.PeerEventSchema, event)))
        );
      },
      { maxSize: 30, wait: 5000 }
    );

    function createDigestQuery(merkleDepth: number, paths: number[][]) {
      return toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          accountId,
          clientId: clock.clientId,
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

    function createEventBatch(events: PeerPB.PeerEvent[]) {
      return toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          accountId,
          clientId: clock.clientId,
          payload: {
            case: 'eventBatch',
            value: { events }
          }
        })
      );
    }

    switch (payload.case) {
      case 'digestQuery': {
        const { merkleDepth, paths } = payload.value;
        const tree = await getMerkleTree(accountId);
        const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
        const result = new Array<{ digest: Uint8Array; path: number[] }>();
        const virtualTreePrefix = Array.from({ length: MAX_DEPTH - tree.maxDepth }).fill(0);
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
        ws.sendBinary(
          toBinary(
            PeerPB.SyncWireMessageSchema,
            create(PeerPB.SyncWireMessageSchema, {
              accountId,
              clientId: clock.clientId,
              payload: {
                case: 'digestUpdate',
                value: { digests: result, merkleDepth: tree.maxDepth }
              }
            })
          )
        );
        break;
      }
      case 'digestUpdate': {
        const { digests, merkleDepth } = payload.value;
        const tree = await getMerkleTree(accountId);
        const MAX_DEPTH = Math.max(merkleDepth, tree.maxDepth);
        const virtualTreePrefix = Array.from({ length: MAX_DEPTH - tree.maxDepth }).fill(0);
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
          if (!mismatch) continue;

          const isLeafNode = path.length === MAX_DEPTH;
          if (isLeafNode) {
            if (isZeroDigest(ourDigest)) continue;
            const timestamp = tree.getMetaByPath(path.slice(virtualTreePrefix.length));
            if (timestamp === null) {
              console.error('data integrity error');
              continue;
            }
            if (isZeroDigest(theirDigest)) {
              batchTimestampsToSend(timestamp);
              continue;
            }
            ws.sendBinary(
              toBinary(
                PeerPB.SyncWireMessageSchema,
                create(PeerPB.SyncWireMessageSchema, {
                  accountId,
                  clientId: clock.clientId,
                  payload: {
                    case: 'hasEventWithTimestampQuery',
                    value: { timestamp }
                  }
                })
              )
            );
          } else {
            ws.sendBinary(
              createDigestQuery(
                tree.maxDepth,
                Array.from({ length: tree.arity }).map((_, i) => [...path, i])
              )
            );
          }
        }
        break;
      }
      case 'handshake': {
        ({ version } = payload.value);
        const tree = await getMerkleTree(accountId);
        ws.sendBinary(createDigestQuery(tree.maxDepth, [[]]));
        break;
      }
      case 'hasEventWithTimestampQuery': {
        const { timestamp } = payload.value;
        const tree = await getMerkleTree(accountId);
        const yes =
          tree.getIndexByMeta(timestamp, (a, b) =>
            a === b ? 0
            : a < b ? -1
            : 1
          ) > -1;
        ws.sendBinary(
          toBinary(
            PeerPB.SyncWireMessageSchema,
            create(PeerPB.SyncWireMessageSchema, {
              accountId,
              clientId: clock.clientId,
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
        console.log(timestamp, yes);
        if (yes) return;
        batchTimestampsToSend(timestamp);
        break;
      }
      case 'eventBatch': {
        await db.transaction(async (tx) => {
          for (const { data, signature, timestamp } of payload.value.events) {
            const verified = verifyData(data, signature, accountId);
            if (!verified) return;
            const event = await receiveMessage(
              {
                accountId,
                clientId: body.clientId,
                data: Buffer.from(data),
                signature,
                timestamp
              },
              tx
            );
            if (event)
              ws.publishBinary(
                `new_events_${accountId}`,
                createEventBatch([create(PeerPB.PeerEventSchema, { data, signature, timestamp })])
              );
          }
        });
        void recomputeMerkleTree(accountId).catch(console.error);
      }
    }
  },
  async open(ws) {
    const { accountId } = ws.data.query;
    const clock = await getLocalClock();
    ws.subscribe(`new_events_${accountId}`);
    ws.sendBinary(
      toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          accountId,
          clientId: clock.clientId,
          payload: {
            case: 'handshake',
            value: { version: '__any__' }
          }
        })
      )
    );
  },
  parse: (_ws, message) => {
    return fromBinary(PeerPB.SyncWireMessageSchema, new Uint8Array(message));
  },
  query: t.Object({ accountId: t.String() })
});
