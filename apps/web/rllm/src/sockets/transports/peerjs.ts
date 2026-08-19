import { type DataConnection, Peer } from 'peerjs';

import type { TTransportFactory, TTransport } from '.';

export class PeerJSTransport implements TTransport {
  id = 'PeerJS';
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

class PeerJSTransportFactory implements TTransportFactory {
  handleSignal() {}
  peer: Peer;
  subscribers = new Map<'error' | 'close', Set<(...args: any[]) => void>>();
  closed = false;

  ready() {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.peer.on('open', () => resolve());
    return promise;
  }

  onError(fn: (remoteId: string, error: unknown) => void) {
    const subscribers = this.subscribers.get('error') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('error', subscribers);
    return () => this.subscribers.get('error')?.delete(fn);
  }

  emitError(remoteId: string, error?: Error) {
    const subscribers = this.subscribers.get('error');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(remoteId, error);
    }
  }
  constructor(clientId: string) {
    this.peer = new Peer(clientId);
  }

  onNewTransport(handler: (remoteId: string, transport: TTransport) => void) {
    const _handler = (conn: DataConnection) => {
      conn.on('open', () => {
        const transport = new PeerJSTransport(conn);
        handler(conn.peer, transport);
      });
      conn.on('error', (error) => this.emitError(conn.peer, error));
    };
    this.peer.on('connection', _handler);
    return () => this.peer.off('connection', _handler);
  }

  onClose(fn: (remoteId: string) => void) {
    const subscribers = this.subscribers.get('close') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('close', subscribers);
    return () => this.subscribers.get('close')?.delete(fn);
  }

  onSignal() {
    return () => {};
  }

  async connect(remoteId: string) {
    const { promise, resolve, reject } = Promise.withResolvers<PeerJSTransport>();
    const conn = this.peer.connect(remoteId);
    conn.on('open', () => {
      conn.on('error', (error) => this.emitError(remoteId, error));
      conn.on('close', () => this.emitClose(remoteId));
      resolve(new PeerJSTransport(conn));
    });
    return promise;
  }

  emitClose(remoteId: string) {
    if (this.closed) return;
    this.closed = true;
    const subscribers = this.subscribers.get('close');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(remoteId);
    }
  }
}

let memo: PeerJSTransportFactory | null = null;
export const peerJSTransportFactory = (clientId: string) => {
  if (memo) return memo;
  return (memo = new PeerJSTransportFactory(clientId));
};
