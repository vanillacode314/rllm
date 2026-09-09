import { Event } from 'event-bus';
import { type DataConnection, Peer } from 'peerjs';

import type { TTransport, TTransportFactory } from '.';

class PeerJSTransportFactory implements TTransportFactory {
  #closeEvent = new Event<string>({ once: true });
  onClose = this.#closeEvent.subscribe.bind(this.#closeEvent);
  #errorEvent = new Event<{ error: unknown; remoteId: string }>();
  onError = this.#errorEvent.subscribe.bind(this.#errorEvent);

  #newTransportEvent = new Event<{ remoteId: string; transport: TTransport }>();

  onNewTransport = this.#newTransportEvent.subscribe.bind(this.#newTransportEvent);

  get id() {
    return 'PeerJS';
  }
  #peer: Peer;

  constructor(clientId: string) {
    this.#peer = new Peer(clientId);
    this.#peer.on('open', () => {
      this.#peer.on('connection', (conn: DataConnection) => {
        conn.on('open', () => {
          this.#newTransportEvent.emit({
            remoteId: conn.peer,
            transport: new PeerJSTransport(conn)
          });
        });
        conn.on('error', (error) => this.#errorEvent.emit({ error, remoteId: conn.peer }));
      });
    });
  }

  async connect(remoteId: string) {
    const { promise, reject, resolve } = Promise.withResolvers<PeerJSTransport>();
    const conn = this.#peer.connect(remoteId);
    conn.on('open', () => {
      conn.on('error', (error) => this.#errorEvent.emit({ error, remoteId }));
      conn.on('close', () => this.#closeEvent.emit(remoteId));
      resolve(new PeerJSTransport(conn));
    });
    return promise;
  }

  handleSignal() {}

  onSignal() {
    return () => {};
  }

  ready() {
    const { promise, resolve } = Promise.withResolvers<void>();
    this.#peer.on('open', () => resolve());
    return promise;
  }
}

export class PeerJSTransport implements TTransport {
  get id() {
    return 'PeerJS';
  }

  get ready() {
    return this.conn.open;
  }

  constructor(private readonly conn: DataConnection) {}

  close() {
    this.conn.close();
  }

  onMessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const handler = (data: unknown) => fn(new Uint8Array(data as never));
    this.conn.on('data', handler);
    return () => this.conn.off('data', handler);
  }

  send(data: Uint8Array<ArrayBuffer>) {
    this.conn.send(data);
  }
}

let memo: null | PeerJSTransportFactory = null;
export const peerJSTransportFactory = (clientId: string) => {
  if (memo) return memo;
  return (memo = new PeerJSTransportFactory(clientId));
};
