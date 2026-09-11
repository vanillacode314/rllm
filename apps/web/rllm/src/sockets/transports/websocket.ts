import { createComputed, createMemo, createRoot, on, untrack } from 'solid-js';
import { AsyncResult, Option } from 'ts-result-option';

import { logger } from '~/db/client';
import { account } from '~/signals/account';
import { env } from '~/utils/env';
import { isOnline } from '~/utils/signals';

import type { TTransport } from '.';
import { ConnectionManager } from '../messages';
import { createPeerSocket } from '../utils';

export class WebsocketTransport implements TTransport {
  get id() {
    return 'WS';
  }

  get ready() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  constructor(private readonly ws: WebSocket) {}

  close() {
    this.ws.close();
  }

  onMessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
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

  onShouldTrySocketConnectionChange((value) => {
    if (value && !connection) {
      console.debug('[WS] online');
      const accountId = Option.from(account())
        .map((account) => account.id)
        .expect("accountId exists otherwise we wouldn't be trying a new socket connection");

      const ws = createPeerSocket(clientId, accountId);

      ws.addEventListener('open', async () => {
        const transport = new WebsocketTransport(ws);
        connection = new ConnectionManager(accountId, clientId, transport);
        await connection.init();
        console.debug('[WS] connected');
      });
      return;
    }
    if (!value && connection) {
      console.debug('[WS] offline');
      connection?.close();
      connection = undefined;
    }
  });
}

function onShouldTrySocketConnectionChange(onChange: (value: boolean) => void) {
  createRoot(() => {
    const shouldPoll = createMemo(
      () => isOnline() && account() !== null && env.VITE_SYNC_SERVER_BASE_URL !== undefined
    );
    createComputed(on(shouldPoll, (value) => onChange(value)));
  });
}
