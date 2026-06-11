import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { Batcher, Debouncer } from '@tanstack/pacer';
import { and, eq, inArray } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { BufferSource } from 'elysia/ws/bun';
import * as PeerPB from 'proto/peers/v1/peer_pb';

import { db } from '~/db/client';
import { getMerkleTree, recomputeMerkleTree } from '~/db/merkle-tree';
import { receiveMessage } from '~/db/messages';
import * as schema from '~/db/schema';
import { verifyData } from '~/utils/auth';
import { getLocalClock } from '~/utils/clock';

const ZERO_DIGEST = new Uint8Array(0);

class ConnectionManager {
  static MANAGERS = new Map<string, ConnectionManager>();
  recomputeMerkleTreeDebouncer = new Debouncer(
    () => {
      console.debug('[WS Debouncer] Recomputing Merkle tree', { accountId: this.accountId });
      return recomputeMerkleTree(this.accountId);
    },
    {
      wait: 1000
    }
  );
  sendHasEventWithTimestampQueryBatcher = new Batcher<string>(
    async (timestamps) => {
      this.ws.sendBinary(
        toBinary(
          PeerPB.SyncWireMessageSchema,
          create(PeerPB.SyncWireMessageSchema, {
            accountId: this.accountId,
            clientId: this.clientId,
            payload: {
              case: 'hasEventWithTimestampQuery',
              value: { timestamps: unique(timestamps) }
            }
          })
        )
      );
    },
    { maxSize: 100, wait: 5000 }
  );
  sendHasEventWithTimestampUpdateBatcher = new Batcher<string>(
    async (timestamps) => {
      const tree = await getMerkleTree(this.accountId);
      const updates = timestamps.map((timestamp) => ({
        timestamp,
        yes:
          tree.getIndexByMeta(timestamp, (a, b) =>
            a === b ? 0
            : a < b ? -1
            : 1
          ) > -1
      }));
      console.debug('[WS HasEventQueryBatch]', { accountId: this.accountId, updates });
      this.ws.sendBinary(
        toBinary(
          PeerPB.SyncWireMessageSchema,
          create(PeerPB.SyncWireMessageSchema, {
            accountId: this.accountId,
            clientId: this.clientId,
            payload: {
              case: 'hasEventWithTimestampUpdates',
              value: {
                updates: updates.map((update) =>
                  create(PeerPB.HasEventWithTimestampUpdateSchema, update)
                )
              }
            }
          })
        )
      );
    },
    { maxSize: 100, wait: 5000 }
  );
  sendTimestampBatcher = new Batcher<string>(
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
            eq(schema.messages.accountId, this.accountId),
            inArray(schema.messages.timestamp, timestamps)
          )
        );
      if (events.length === 0) {
        console.warn('[WS Batcher] Timestamps requested but events not found', {
          accountId: this.accountId,
          timestamps
        });
        return;
      }
      console.debug('[WS Batcher] Sending batch', {
        accountId: this.accountId,
        count: events.length
      });
      this.ws.sendBinary(
        this.createEventBatch(events.map((event) => create(PeerPB.PeerEventSchema, event)))
      );
    },
    { maxSize: 30, wait: 5000 }
  );
  constructor(
    private accountId: string,
    private clientId: string,
    private ws: { sendBinary: (data: BufferSource, compress?: boolean) => void }
  ) {}
  static deleteManager(id: string) {
    const manager = ConnectionManager.MANAGERS.get(id);
    if (!manager) return;
    ConnectionManager.MANAGERS.delete(id);
    manager.sendTimestampBatcher.cancel();
    manager.sendHasEventWithTimestampUpdateBatcher.cancel();
    manager.recomputeMerkleTreeDebouncer.flush();
  }
  static getManager(id: string) {
    return ConnectionManager.MANAGERS.get(id);
  }
  static async initManager(
    accountId: string,
    ws: { id: string; sendBinary: (data: BufferSource, compress?: boolean) => void }
  ) {
    const clock = await getLocalClock();
    const manager = new ConnectionManager(accountId, clock.clientId, ws);
    ConnectionManager.MANAGERS.set(ws.id, manager);
    return manager;
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
        payload: {
          case: 'eventBatch',
          value: { events }
        }
      })
    );
  }
  recomputeMerkleTree = () => this.recomputeMerkleTreeDebouncer.maybeExecute();
  sendHasEventWithTimestampQuery = (timestamp: string) =>
    this.sendHasEventWithTimestampQueryBatcher.addItem(timestamp);
  sendHasEventWithTimestampUpdate = (timestamp: string) =>
    this.sendHasEventWithTimestampUpdateBatcher.addItem(timestamp);
  sendTimestamp = (timestamp: string) => {
    console.debug('[WS Batcher] Adding timestamp', { accountId: this.accountId, timestamp });
    return this.sendTimestampBatcher.addItem(timestamp);
  };
}
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
            merkleDepth: t.Integer({ maximum: 64, minimum: 0 }),
            paths: t.Array(t.Object({ segments: t.Array(t.Integer()) }))
          })
        }),
        t.Object({
          case: t.Literal('digestUpdate'),
          value: t.Object({
            digests: t.Array(
              t.Object({
                digest: t.Uint8Array(),
                path: t.Array(t.Integer())
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
          value: t.Object({ timestamps: t.Array(t.String()) })
        }),
        t.Object({
          case: t.Literal('hasEventWithTimestampUpdates'),
          value: t.Object({
            updates: t.Array(t.Object({ timestamp: t.String(), yes: t.Boolean() }))
          })
        }),
        t.Object({
          case: t.Undefined(),
          value: t.Undefined()
        })
      ])
    },
    { additionalProperties: true }
  ),

  async close(ws) {
    console.debug('[WS Close] Client disconnected', { wsId: ws.id });
    ConnectionManager.deleteManager(ws.id);
  },
  async message(ws, body) {
    const manager = ConnectionManager.getManager(ws.id);
    if (!manager) {
      console.error('[WS Error] ConnectionManager not found', { wsId: ws.id });
      return;
    }
    const clock = await getLocalClock();
    const { accountId, payload } = body;
    if (accountId !== ws.data.query.accountId) {
      console.warn('[WS Warn] accountId mismatch', {
        expected: ws.data.query.accountId,
        got: accountId
      });
      return;
    }
    console.debug('[WS Received Message]', { accountId, case: payload.case, wsId: ws.id });
    let version: null | string = null;

    switch (payload.case) {
      case 'digestQuery': {
        const { merkleDepth, paths } = payload.value;
        console.debug('[WS DigestQuery]', { accountId, merkleDepth, paths: paths.length });
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
        console.debug('[WS DigestUpdate]', { accountId, digests: digests.length, merkleDepth });
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
              console.error('[WS Error] data integrity error', { accountId, timestamp });
              continue;
            }
            if (isZeroDigest(theirDigest)) {
              manager.sendTimestamp(timestamp);
              continue;
            }
            manager.sendHasEventWithTimestampQuery(timestamp);
          } else {
            ws.sendBinary(
              manager.createDigestQuery(
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
        console.debug('[WS Handshake]', { accountId, clientId: body.clientId, version });
        const tree = await getMerkleTree(accountId);
        ws.sendBinary(manager.createDigestQuery(tree.maxDepth, [[]]));
        break;
      }
      case 'hasEventWithTimestampQuery': {
        const { timestamps } = payload.value;
        console.debug('[WS HasEventQuery]', { accountId, timestamps });
        for (const timestamp of timestamps) manager.sendHasEventWithTimestampUpdate(timestamp);
        break;
      }
      case 'hasEventWithTimestampUpdates': {
        const { updates } = payload.value;
        console.debug('[WS HasEventUpdate]', { accountId, updates });
        for (const { timestamp, yes } of updates) {
          if (!yes) manager.sendTimestamp(timestamp);
        }
        break;
      }
      case 'eventBatch': {
        console.debug('[WS EventBatch]', { accountId, events: payload.value.events.length });
        await db.transaction(async (tx) => {
          for (const { data, signature, timestamp } of payload.value.events) {
            const verified = verifyData(data, signature, accountId);
            if (!verified) continue;
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
                manager.createEventBatch([
                  create(PeerPB.PeerEventSchema, { data, signature, timestamp })
                ])
              );
          }
        });
        void manager.recomputeMerkleTree();
      }
    }
  },
  async open(ws) {
    const { accountId } = ws.data.query;
    await ConnectionManager.initManager(accountId, ws);
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
    console.debug('[WS Open] Client connected', { accountId, wsId: ws.id });
  },
  parse: (_ws, message) => {
    if (!(message instanceof Buffer)) throw new Error('Invalid message type');
    return fromBinary(PeerPB.SyncWireMessageSchema, new Uint8Array(message));
  },
  query: t.Object({ accountId: t.String() })
});
