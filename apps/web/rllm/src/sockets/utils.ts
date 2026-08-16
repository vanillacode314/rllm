import { makeReconnectingWS } from '@solid-primitives/websocket';

import { env } from '~/utils/env';

export function createPeerSocket(
  clientId: string,
  accountId: string,
  peer: boolean = false
): WebSocket {
  if (env.VITE_SYNC_SERVER_BASE_URL === undefined)
    throw new Error('VITE_SYNC_SERVER_BASE_URL is not defined');
  const socketUrl = new URL(env.VITE_SYNC_SERVER_BASE_URL);
  socketUrl.protocol = socketUrl.protocol.replace('http', 'ws');
  socketUrl.pathname = '/api/v1/ws';
  socketUrl.searchParams.set('clientId', clientId);
  socketUrl.searchParams.set('accountId', accountId);
  if (peer) socketUrl.searchParams.set('peer', 'true');

  return makeReconnectingWS(socketUrl.toString());
}
