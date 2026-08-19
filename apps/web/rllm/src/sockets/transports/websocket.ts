import { createComputed, createMemo, createRoot, untrack } from 'solid-js';
import { AsyncResult, Option } from 'ts-result-option';

import { logger } from '~/db/client';
import { account } from '~/signals/account';
import { env } from '~/utils/env';
import { isOnline } from '~/utils/signals';

import { ConnectionManager } from '../messages';
import { createPeerSocket } from '../utils';
import type { TTransport } from '.';

export class WebsocketTransport implements TTransport {
  id = 'WS';
  get ready() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  constructor(readonly ws: WebSocket) {}

  close() {
    this.ws.close();
  }

  onmessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const handler = async (e: MessageEvent) => fn(new Uint8Array(await e.data.arrayBuffer()));
    this.ws.addEventListener('message', handler);
    return () => this.ws.removeEventListener('message', handler);
  }

  send(data: Uint8Array<ArrayBuffer>) {
    this.ws.send(data);
  }
}

export async function initWebsocketTransport() {
  let connection: ConnectionManager | undefined;
  const clientId = Option.from(await logger.getMetadata('clientId'))
    .okOrElse(() => new Error('Missing clientId in local database metadata'))
    .unwrap();

  const load = () =>
    AsyncResult.from(
      async function () {
        if (connection) return;
        const $account = account();
        if ($account === null) return;
        const accountId = $account.id;

        const ws = createPeerSocket(clientId, accountId);

        ws.addEventListener('open', async () => {
          const transport = new WebsocketTransport(ws);
          connection = new ConnectionManager($account.id, clientId, transport, 'WebSocket');
          connection.init();
          console.debug('[WS] connected');
        });
      },
      (e) => new Error(`Error while setting up websocket`, { cause: e })
    );

  function unload() {
    console.debug('[WS] offline');
    connection?.close();
  }

  createRoot(() => {
    const shouldPoll = createMemo(
      () => isOnline() && account() !== null && env.VITE_SYNC_SERVER_BASE_URL !== undefined
    );
    createComputed(() => {
      const $shouldPoll = shouldPoll();
      untrack(() => {
        if (!$shouldPoll) {
          unload();
          return;
        }

        console.debug('[WS] online');
        load().unwrap();
      });
    });
  });
}
