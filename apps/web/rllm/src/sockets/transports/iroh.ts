import { BiStream, Connection, Endpoint, EndpointAddr } from '@salvatoret/iroh';
import * as z from 'zod/mini';

import type { TTransportFactory, TTransport, TSignal } from '.';

const ALPN = new TextEncoder().encode('rllm/1');

export class IrohTransport implements TTransport {
  id = 'Iroh';
  subscribers = new Map<'message' | 'error', Set<(...args: any[]) => void>>();
  started = false;

  get ready() {
    return this.conn.closeReason() === undefined;
  }

  onError(fn: (error: unknown) => void) {
    const subscribers = this.subscribers.get('error') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('error', subscribers);
    return () => this.subscribers.get('error')?.delete(fn);
  }

  emitError(error?: unknown) {
    const subscribers = this.subscribers.get('error');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(error);
    }
  }

  emitMessage(data: Uint8Array<ArrayBuffer>) {
    const subscribers = this.subscribers.get('message');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(data);
    }
  }

  constructor(
    private readonly conn: Connection,
    private readonly stream: BiStream
  ) {}

  close() {
    this.stream.send.finish();
    this.conn.close(0, new Uint8Array());
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
        this.emitError(error);
        throw error;
      }
    }
    return data;
  }

  async startReadLoop() {
    this.started = true;
    while (true) {
      const header = (await this.readExact(4))!;
      if (!this.ready) return;

      const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
      const messageLength = view.getUint32(0, true);
      const message = await this.readExact(messageLength);
      if (!this.ready) return;

      this.emitMessage(message as Uint8Array<ArrayBuffer>);
    }
  }

  onmessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const subscribers = this.subscribers.get('message') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('message', subscribers);
    if (!this.started) this.startReadLoop();
    return () => this.subscribers.get('message')?.delete(fn);
  }

  send(data: Uint8Array<ArrayBuffer>) {
    const header = new Uint8Array(4);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    view.setUint32(0, data.byteLength, true);
    this.stream.send
      .write(header)
      .then(() => this.stream.send.write(data))
      .catch(() => this.emitError(new Error('Failed to send message')));
  }
}

class IrohTransportFactory implements TTransportFactory {
  id = 'Iroh';
  endpoints = new Map<string, Endpoint>();
  subscribers = new Map<
    'error' | 'signal' | 'transport' | 'close',
    Set<(...args: any[]) => void>
  >();
  closed = false;

  ready = () => Promise.resolve();

  emitNewTransport(remoteId: string, transport: TTransport) {
    const subscribers = this.subscribers.get('transport');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(remoteId, transport);
    }
  }

  onNewTransport(handler: (remoteId: string, transport: TTransport) => void) {
    const subscribers = this.subscribers.get('transport') ?? new Set();
    subscribers.add(handler);
    this.subscribers.set('transport', subscribers);
    return () => this.subscribers.get('transport')?.delete(handler);
  }

  onClose(fn: (remoteId: string) => void) {
    const subscribers = this.subscribers.get('close') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('close', subscribers);
    return () => this.subscribers.get('close')?.delete(fn);
  }

  async connect(remoteId: string) {
    if (this.endpoints.has(remoteId)) throw new Error('Already connected');
    const node = await Endpoint.create();
    await node.online();
    this.endpoints.set(remoteId, node);
    node.setAlpns([ALPN]);

    const addr = node.endpointAddr();
    this.emitSignal(remoteId, { data: addr.endpointId(), type: 'iroh' });

    const conn = await node.accept();
    if (!conn) throw new Error('No connection');

    const stream = await conn.acceptBi();
    const transport = new IrohTransport(conn, stream);
    transport.onError((error) => this.emitError(remoteId, error));
    return transport;
  }

  async handleSignal(remoteId: string, signal: TSignal) {
    if (this.endpoints.has(remoteId)) return;
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
    this.endpoints.set(remoteId, node);

    const conn = await node.connect(remoteAddr, ALPN);
    const stream = await conn.openBi();
    const transport = new IrohTransport(conn, stream);
    transport.onError((error) => this.emitError(remoteId, error));
    this.emitNewTransport(remoteId, transport);
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

  onError(fn: (remoteId: string, error: unknown) => void) {
    const subscribers = this.subscribers.get('error') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('error', subscribers);
    return () => this.subscribers.get('error')?.delete(fn);
  }

  emitError(remoteId: string, error?: unknown) {
    const subscribers = this.subscribers.get('error');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(remoteId, error);
    }
  }

  onSignal(handler: (to: string, signal: TSignal) => void) {
    const subscribers = this.subscribers.get('signal') ?? new Set();
    subscribers.add(handler);
    this.subscribers.set('signal', subscribers);
    return () => void this.subscribers.get('signal')?.delete(handler);
  }

  emitSignal(to: string, signal: object) {
    const subscribers = this.subscribers.get('signal');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(to, signal);
    }
  }
}

export const irohTransportFactory = new IrohTransportFactory();
