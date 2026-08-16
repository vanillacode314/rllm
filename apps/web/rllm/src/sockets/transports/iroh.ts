import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { BiStream, Connection, Endpoint, EndpointAddr } from '@salvatoret/iroh';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import { logger } from '~/db/client';
import { account } from '~/signals/account';

import { ConnectionManager, type TTransport } from '../messages';
import { createPeerSocket } from '../utils';

export class IrohTransport implements TTransport {
  get ready() {
    return this.conn.closeReason() === undefined;
  }

  constructor(
    private readonly conn: Connection,
    private readonly stream: BiStream
  ) {}

  close() {
    this.stream.send.finish();
    this.conn.close(0, new Uint8Array());
  }

  onmessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    let stopped = false;
    (async () => {
      while (true) {
        // oxlint-disable-next-line no-await-in-loop
        const header = (await this.stream.recv.readChunk(4))!;
        const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
        const messageLength = view.getUint32(0, true);
        const message = new Uint8Array(messageLength);
        let left = messageLength;
        while (left > 0) {
          if (left === 0) throw new Error('Unreachable');
          // oxlint-disable-next-line no-await-in-loop
          const data = (await this.stream.recv.readChunk(left))!;
          message.set(data, messageLength - left);
          left -= data.byteLength;
        }
        if (stopped) {
          this.close();
          return;
        }
        fn(message as Uint8Array<ArrayBuffer>);
      }
    })();
    return () => {
      stopped = true;
    };
  }

  send(data: Uint8Array<ArrayBuffer>) {
    const header = new Uint8Array(4);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    view.setUint32(0, data.byteLength, true);
    this.stream.send.write(header).then(() => this.stream.send.write(data));
  }
}

const peers = new Map<string, ConnectionManager>();
export async function initIrohTransport() {
  const ALPN = new TextEncoder().encode('rllm/1');

  const clientId = Option.from(await logger.getMetadata('clientId'))
    .okOrElse(() => new Error('Missing clientId in local database metadata'))
    .unwrap();
  const $account = account();
  if ($account === null) return;
  const accountId = $account.id;

  const ws = createPeerSocket(clientId, accountId, true);
  const signalSchema = z.object({
    id: z.string(),
    type: z.literal('offer')
  });
  function sendSignal(to: string, data: z.output<typeof signalSchema>) {
    ws.send(
      toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          accountId: $account!.id,
          clientId,
          payload: {
            case: 'webrtcSignal',
            value: {
              data: JSON.stringify(data),
              to
            }
          }
        })
      )
    );
  }
  ws.addEventListener('message', async (e) => {
    const SUPPORTED_EVENTS = ['peerConnected', 'webrtcSignal'];
    const body = fromBinary(
      PeerPB.SyncWireMessageSchema,
      new Uint8Array(await e.data.arrayBuffer())
    );
    if (body.accountId !== $account.id) return;
    if (!SUPPORTED_EVENTS.includes(body.payload.case ?? '')) return;
    switch (body.payload.case) {
      case 'webrtcSignal': {
        const remoteId = body.clientId;
        if (peers.has(remoteId)) return;
        const data = safeParseJson(body.payload.value.data, {
          validate: signalSchema.parse
        }).expect('Invalid data');
        console.debug(`[Iroh] got connection request from "${remoteId}"`);

        const remoteAddr = EndpointAddr.fromEndpointId(data.id);

        const node = await Endpoint.create();
        await node.online();

        const conn = await node.connect(remoteAddr, ALPN);
        const stream = await conn.openBi();
        const transport = new IrohTransport(conn, stream);
        const connection = new ConnectionManager($account.id, clientId, transport, 'Iroh');
        connection.init();
        break;
      }
      case 'peerConnected': {
        const remoteId = body.payload.value.clientId;
        console.debug(`[Iroh] new peer connected "${remoteId}"`);

        const node = await Endpoint.create();
        await node.online();
        node.setAlpns([ALPN]);

        const addr = node.endpointAddr();
        sendSignal(remoteId, { id: addr.endpointId(), type: 'offer' });

        const conn = await node.accept();
        if (!conn) throw new Error('No connection');

        const stream = await conn.acceptBi();
        const transport = new IrohTransport(conn, stream);
        const connection = new ConnectionManager($account.id, clientId, transport, 'Iroh');
        connection.init();
      }
    }
  });
}
