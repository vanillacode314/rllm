import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import * as z from 'zod/mini';

import { ConnectionManager } from '../messages';
import { createPeerSocket } from '../utils';
import { safeParseJson } from 'ts-result-option/utils';
import { withTimeout } from '~/utils/promises';

const signalSchema = z.object({
  data: z.unknown(),
  type: z.string()
});

export type TSignal = z.infer<typeof signalSchema>;

export interface TTransportFactory {
  id: string;
  connect(remoteId: string): Promise<TTransport>;
  onSignal(fn: (remoteId: string, signal: TSignal) => void): () => void;
  onError(fn: (remoteId: string, error: unknown) => void): () => void;
  onNewTransport(fn: (remoteId: string, transport: TTransport) => void): () => void;
  handleSignal(remoteId: string, signal: TSignal): void;
  onClose(fn: (remoteId: string) => void): () => void;
  ready(): Promise<void>;
}

export interface TTransport {
  close: () => void;
  id: string;
  onmessage: (fn: (data: Uint8Array<ArrayBuffer>) => void) => () => void;
  ready: boolean;
  send: (data: Uint8Array<ArrayBuffer>) => void;
}

export class PeerManager {
  static #accountId: string = '';
  static #clientId: string = '';
  static #peers = new Map<string, ConnectionManager>();
  static #transports = new Map<TTransportFactory, { cleanup: () => void }>();
  static #ws: WebSocket;

  static async init(accountId: string, clientId: string) {
    this.#accountId = accountId;
    this.#clientId = clientId;

    this.#ws = createPeerSocket(clientId, accountId, true);

    this.#ws.addEventListener('message', async (e) => {
      const SUPPORTED_EVENTS = ['webrtcSignal', 'peerConnected'];
      const body = fromBinary(
        PeerPB.SyncWireMessageSchema,
        new Uint8Array(await e.data.arrayBuffer())
      );
      if (body.accountId !== accountId) return;
      if (!SUPPORTED_EVENTS.includes(body.payload.case ?? '')) return;
      switch (body.payload.case) {
        case 'webrtcSignal': {
          const signal = safeParseJson(body.payload.value.data, {
            validate: signalSchema.parse
          }).unwrap();
          for (const [transport] of this.#transports) {
            transport.handleSignal(body.clientId, signal);
          }
          break;
        }
        case 'peerConnected': {
          const remoteId = body.payload.value.clientId;
          for (const [transport] of this.#transports) {
            try {
              // oxlint-disable-next-line no-await-in-loop
              const t = await withTimeout(
                transport.ready().then(() => transport.connect(remoteId)),
                5 * 1000
              );
              const connection = new ConnectionManager(accountId, clientId, t);
              connection.init();
              this.registerPeer(remoteId, connection);
              break;
            } catch (error) {
              console.error(
                `Failed to connect to peer ${remoteId} using transport ${transport.id}`,
                error
              );
            }
          }
        }
      }
    });
  }

  static async onSignal(to: string, signal: TSignal) {
    this.#ws.send(
      toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          accountId: this.#accountId,
          clientId: this.#clientId,
          payload: {
            case: 'webrtcSignal',
            value: create(PeerPB.WebRTCSignalSchema, { data: JSON.stringify(signal), to })
          }
        })
      )
    );
  }

  static onNewTransport(remoteId: string, transport: TTransport) {
    const connection = new ConnectionManager(this.#accountId, this.#clientId, transport);
    connection.init();
    this.registerPeer(remoteId, connection);
  }

  static registerPeer(remoteId: string, connection: ConnectionManager) {
    this.#peers.set(remoteId, connection);
    this.#ws.send(
      toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          clientId: this.#clientId,
          accountId: this.#accountId,
          payload: {
            case: 'connectedToPeer',
            value: { peerId: remoteId }
          }
        })
      )
    );
  }

  static unregisterPeer(remoteId: string) {
    this.#peers.get(remoteId)?.close();
    this.#peers.delete(remoteId);
    this.#ws.send(
      toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          clientId: this.#clientId,
          accountId: this.#accountId,
          payload: {
            case: 'disconnectedFromPeer',
            value: { peerId: remoteId }
          }
        })
      )
    );
  }

  static registerTransport(transport: TTransportFactory) {
    const unsubscribe1 = transport.onNewTransport((remoteId, transport) =>
      this.onNewTransport(remoteId, transport)
    );
    const unsubscribe2 = transport.onSignal((to, signal) => this.onSignal(to, signal));
    const unsubscribe3 = transport.onClose((remoteId) => this.unregisterPeer(remoteId));
    const unsubscribe4 = transport.onError((remoteId) => this.unregisterPeer(remoteId));
    this.#transports.set(transport, {
      cleanup: () => {
        unsubscribe1();
        unsubscribe2();
        unsubscribe3();
        unsubscribe4();
      }
    });
  }

  static unregisterTransport(transport: TTransportFactory) {
    this.#transports.get(transport)?.cleanup?.();
    this.#transports.delete(transport);
  }
}
