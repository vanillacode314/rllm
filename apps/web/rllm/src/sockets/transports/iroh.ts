import { BiStream, Connection, Endpoint, EndpointAddr } from '@salvatoret/iroh';
import { Event } from 'event-bus';
import * as z from 'zod/mini';

import type { TSignal, TTransport, TTransportFactory } from '.';

const ALPN = new TextEncoder().encode('rllm/1');

class IrohTransportFactory implements TTransportFactory {
  #closeEvent = new Event<string>({ once: true });
  onClose = this.#closeEvent.subscribe.bind(this.#closeEvent);
  #errorEvent = new Event<{ error: unknown; remoteId: string; }>();
  onError = this.#errorEvent.subscribe.bind(this.#errorEvent);
  #newTransportEvent = new Event<{ remoteId: string; transport: TTransport }>();

  onNewTransport = this.#newTransportEvent.subscribe.bind(this.#newTransportEvent);

  #signalEvent = new Event<{ remoteId: string; signal: TSignal }>();

  onSignal = this.#signalEvent.subscribe.bind(this.#signalEvent);
  get id() {
    return 'Iroh';
  }

  #endpoints = new Map<string, Endpoint>();

  async connect(remoteId: string) {
    if (this.#endpoints.has(remoteId)) throw new Error('Already connected');
    const node = await Endpoint.create();
    await node.online();
    this.#endpoints.set(remoteId, node);
    node.setAlpns([ALPN]);

    const addr = node.endpointAddr();
    this.#signalEvent.emit({ remoteId, signal: { data: addr.endpointId(), type: 'iroh' } });

    const conn = await node.accept();
    if (!conn) throw new Error('No connection');

    const stream = await conn.acceptBi();
    const transport = new IrohTransport(conn, stream);
    transport.onError((error) => this.#errorEvent.emit({ error, remoteId }));
    return transport;
  }

  async handleSignal(remoteId: string, signal: TSignal) {
    if (this.#endpoints.has(remoteId)) return;
    const signalSchema = z.discriminatedUnion('type', [
      z.object({
        data: z.string(),
        type: z.literal('iroh')
      })
    ]);
    const result = signalSchema.safeParse(signal);
    if (!result.success) return;
    const { data } = result.data;
    const remoteAddr = EndpointAddr.fromEndpointId(data);

    const node = await Endpoint.create();
    await node.online();
    this.#endpoints.set(remoteId, node);

    const conn = await node.connect(remoteAddr, ALPN);
    const stream = await conn.openBi();
    const transport = new IrohTransport(conn, stream);
    transport.onError((error) => this.#errorEvent.emit({ error, remoteId }));
    this.#newTransportEvent.emit({ remoteId, transport });
  }
  ready = () => Promise.resolve();
}

export class IrohTransport implements TTransport {
  #errorEvent = new Event();
  onError = this.#errorEvent.subscribe.bind(this.#errorEvent);
  get id() {
    return 'Iroh';
  }

  get ready() {
    return this.conn.closeReason() === undefined;
  }

  #messageEvent = new Event<Uint8Array<ArrayBuffer>>();

  #readLoopInitialized = false;

  constructor(
    private readonly conn: Connection,
    private readonly stream: BiStream
  ) {}

  close() {
    this.stream.send.finish();
    this.conn.close(0, new Uint8Array());
  }

  async initializeReadLoop() {
    if (this.#readLoopInitialized) return;
    this.#readLoopInitialized = true;
    while (true) {
      const header = (await this.readExact(4))!;
      if (!this.ready) return;

      const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
      const messageLength = view.getUint32(0, true);
      const message = await this.readExact(messageLength);
      if (!this.ready) return;

      this.#messageEvent.emit(message);
    }
  }

  onMessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const unsubscribe = this.#messageEvent.subscribe(fn);
    this.initializeReadLoop();
    return unsubscribe;
  }

  async readExact(byteLength: number) {
    const data = new Uint8Array(byteLength);
    let read = 0;
    while (read < byteLength) {
      try {
        const chunk = await this.stream.recv.readChunk(byteLength - read);
        if (!chunk) throw new Error('No chunk, stream closed');
        data.set(chunk, read);
        read += chunk.byteLength;
      } catch (error) {
        this.#errorEvent.emit(error);
        throw error;
      }
    }
    return data;
  }

  send(data: Uint8Array<ArrayBuffer>) {
    const header = new Uint8Array(4);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    view.setUint32(0, data.byteLength, true);
    this.stream.send
      .write(header)
      .then(() => this.stream.send.write(data))
      .catch(() => this.#errorEvent.emit(new Error('Failed to send message')));
  }
}

export const irohTransportFactory = new IrohTransportFactory();
