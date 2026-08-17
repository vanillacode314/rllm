import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { type DataConnection, Peer } from 'peerjs';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import { Option } from 'ts-result-option';

import { logger } from '~/db/client';
import { account } from '~/signals/account';

import { ConnectionManager, type TTransport } from '../messages';
import { createPeerSocket } from '../utils';

export class PeerJSTransport implements TTransport {
  get ready() {
    return this.conn.open;
  }

  constructor(readonly conn: DataConnection) {}

  close() {
    this.conn.close();
  }

  onmessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const handler = (data: unknown) => fn(new Uint8Array(data as never));
    this.conn.on('data', handler);
    return () => this.conn.off('data', handler);
  }

  send(data: Uint8Array<ArrayBuffer>) {
    this.conn.send(data);
  }
}

export async function initPeerJSTransport() {
  const clientId = Option.from(await logger.getMetadata('clientId'))
    .okOrElse(() => new Error('Missing clientId in local database metadata'))
    .unwrap();
  const $account = account();
  if ($account === null) return;
  const accountId = $account.id;

  const peer = new Peer(clientId);
  peer.on('open', () => {
    const ws = createPeerSocket(clientId, accountId, true);
    function handleConnection(conn: DataConnection) {
      conn.on('open', async () => {
        function cleanup() {
          connection.close();
          if (ws.readyState !== WebSocket.OPEN) return;
          ws.send(
            toBinary(
              PeerPB.SyncWireMessageSchema,
              create(PeerPB.SyncWireMessageSchema, {
                accountId,
                payload: {
                  case: 'removePeer',
                  value: { peerId: conn.peer }
                }
              })
            )
          );
        }
        conn.on('close', cleanup);
        conn.on('error', (err) => {
          console.error(`[PeerJS] error from "${conn.peer}"`, err);
          cleanup();
        });
        console.debug(`[PeerJS] connected to "${conn.peer}"`);
        const transport = new PeerJSTransport(conn);
        const connection = new ConnectionManager(accountId, clientId, transport, 'PeerJS');
        connection.init();
      });
    }
    peer.on('connection', handleConnection);
    ws.addEventListener('message', async (e) => {
      const SUPPORTED_EVENTS = ['peerConnected'];
      const body = fromBinary(
        PeerPB.SyncWireMessageSchema,
        new Uint8Array(await e.data.arrayBuffer())
      );
      if (body.accountId !== $account.id) return;
      if (!SUPPORTED_EVENTS.includes(body.payload.case ?? '')) return;
      switch (body.payload.case) {
        case 'peerConnected': {
          const remoteId = body.payload.value.clientId;
          console.debug(`[PeerJS] new peer connected "${remoteId}`);
          const conn = peer.connect(remoteId);
          handleConnection(conn);
        }
      }
    });
  });
}
