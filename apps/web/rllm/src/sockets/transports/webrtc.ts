import * as z from 'zod/mini';

import type { TTransportFactory, TTransport, TSignal } from '.';

class WebRTCEndpoint {
  #pc = new RTCPeerConnection();
  #pendingIceCandidates = new Array<RTCIceCandidate>();
  #subscribers = new Map<'error' | 'signal' | 'close', Set<(...args: any[]) => void>>();
  get maxMessageSize() {
    return this.#pc.sctp?.maxMessageSize;
  }
  async acceptAnswer(answer: RTCSessionDescriptionInit) {
    await this.#pc.setRemoteDescription(answer);
    while (this.#pendingIceCandidates.length > 0) {
      const candidate = this.#pendingIceCandidates.shift();
      // oxlint-disable-next-line no-await-in-loop
      await this.#pc.addIceCandidate(candidate);
    }
  }
  async acceptOffer(id: string, offer: RTCSessionDescriptionInit) {
    const { promise, reject, resolve } = Promise.withResolvers<RTCDataChannel>();
    this.#pc.ondatachannel = (e) => {
      const dc = e.channel;
      dc.onopen = () => resolve(dc);
      dc.onerror = reject;
    };
    this.#pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      this.emitSignal(id, { data: candidate, type: 'ice' });
    };
    this.#pc.onconnectionstatechange = () => {
      if (this.#pc.connectionState === 'closed') {
        this.emitClose();
        return;
      }
      if (this.#pc.connectionState === 'failed') {
        this.emitError();
        return;
      }
      if (this.#pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (this.#pc.connectionState === 'disconnected') {
            this.emitClose();
          }
        }, 2000);
        return;
      }
    };
    await this.#pc.setRemoteDescription(offer);
    while (this.#pendingIceCandidates.length > 0) {
      const candidate = this.#pendingIceCandidates.shift();
      // oxlint-disable-next-line no-await-in-loop
      await this.#pc.addIceCandidate(candidate);
    }
    const answer = await this.#pc.createAnswer();
    await this.#pc.setLocalDescription(answer);
    this.emitSignal(id, { data: answer, type: 'answer' });
    return promise;
  }
  onSignal(handler: (to: string, signal: object) => void) {
    const subscribers = this.#subscribers.get('signal') ?? new Set();
    subscribers.add(handler);
    this.#subscribers.set('signal', subscribers);
    return () => this.#subscribers.get('signal')?.delete(handler);
  }
  async addIceCandidate(candidate: RTCIceCandidate) {
    if (this.#pc.remoteDescription) {
      await this.#pc.addIceCandidate(candidate);
    } else {
      this.#pendingIceCandidates.push(candidate);
    }
  }
  emitClose() {
    const subscribers = this.#subscribers.get('close');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler();
    }
  }
  async connect(id: string) {
    const { promise, reject, resolve } = Promise.withResolvers<RTCDataChannel>();
    const dc = this.#pc.createDataChannel('sync');
    this.#pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      this.emitSignal(id, { data: candidate, type: 'ice' });
    };
    this.#pc.onconnectionstatechange = () => {
      if (this.#pc.connectionState === 'closed') {
        this.emitClose();
        return;
      }
      if (this.#pc.connectionState === 'failed') {
        this.emitError();
        return;
      }
      if (this.#pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (this.#pc.connectionState === 'disconnected') {
            this.emitClose();
          }
        }, 2000);
        return;
      }
    };
    dc.onopen = () => resolve(dc);
    dc.onerror = reject;
    const offer = await this.#pc.createOffer();
    this.#pc.setLocalDescription(offer);
    this.emitSignal(id, { data: offer, type: 'offer' });
    return promise;
  }
  onClose(fn: () => void): () => void {
    const subscribers = this.#subscribers.get('close') ?? new Set();
    subscribers.add(fn);
    this.#subscribers.set('close', subscribers);
    return () => this.#subscribers.get('close')?.delete(fn);
  }
  emitSignal(to: string, signal: object) {
    const subscribers = this.#subscribers.get('signal');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(to, signal);
    }
  }
  onError(fn: (error: Error) => void) {
    const subscribers = this.#subscribers.get('error') ?? new Set();
    subscribers.add(fn);
    this.#subscribers.set('error', subscribers);
    return () => this.#subscribers.get('error')?.delete(fn);
  }
  emitError(error?: Error) {
    const subscribers = this.#subscribers.get('error');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(error);
    }
  }
}

class WebRTCTransport implements TTransport {
  id = 'WebRTC';
  subscribers = new Map<'message', Set<(data: Uint8Array<ArrayBuffer>) => void>>();
  started = false;
  get ready() {
    return this.dc.readyState === 'open';
  }
  constructor(
    readonly dc: RTCDataChannel,
    readonly maxMessageSize: number = 16384
  ) {}

  close() {
    this.dc.close();
  }

  async readExact(bytes: number, reader: ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>) {
    const data = new Uint8Array(bytes);
    let offset = 0;
    while (offset < bytes) {
      const { done, value } = await reader.read();
      if (done) throw new Error('Unexpected end of stream');
      data.set(value, offset);
      offset += value.length;
    }
    return data;
  }

  async startReadLoop() {
    if (this.started) return;
    this.started = true;

    const stream = new ReadableStream({
      start: (controller) => {
        this.dc.onmessage = (e) => controller.enqueue(new Uint8Array(e.data));
        this.dc.onclose = () => controller.close();
      }
    });
    const reader = stream.getReader();
    while (true) {
      const header = await this.readExact(4, reader);
      const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
      const messageLength = view.getUint32(0, true);
      const message = await this.readExact(messageLength, reader);
      this.emitMessage(message);
    }
  }

  emitMessage(data: Uint8Array<ArrayBuffer>) {
    const subscribers = this.subscribers.get('message');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(data);
    }
  }

  onmessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const subscribers = this.subscribers.get('message') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('message', subscribers);
    this.startReadLoop();
    return () => this.subscribers.get('message')?.delete(fn);
  }

  send(data: Uint8Array<ArrayBuffer>) {
    const header = new Uint8Array(4);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    view.setUint32(0, data.byteLength, true);
    this.dc.send(header);
    let left = data.byteLength;
    while (left > 0) {
      const chunk = data.slice(0, Math.min(left, this.maxMessageSize));
      this.dc.send(chunk);
      data = data.slice(chunk.byteLength);
      left -= chunk.byteLength;
    }
  }
}

class WebRTCTransportFactory implements TTransportFactory {
  id = 'WebRTC';
  peers = new Map<string, WebRTCEndpoint>();
  subscribers = new Map<
    'error' | 'close' | 'signal' | 'transport',
    Set<(...args: any[]) => void>
  >();
  ready = () => Promise.resolve();

  onNewTransport(handler: (remoteId: string, transport: TTransport) => void) {
    const subscribers = this.subscribers.get('transport') ?? new Set();
    subscribers.add(handler);
    this.subscribers.set('transport', subscribers);
    return () => this.subscribers.get('transport')?.delete(handler);
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

  onClose(fn: (remoteId: string) => void) {
    const subscribers = this.subscribers.get('close') ?? new Set();
    subscribers.add(fn);
    this.subscribers.set('close', subscribers);
    return () => this.subscribers.get('close')?.delete(fn);
  }

  onSignal(handler: (remoteId: string, signal: TSignal) => void) {
    const subscribers = this.subscribers.get('signal') ?? new Set();
    subscribers.add(handler);
    this.subscribers.set('signal', subscribers);
    return () => void this.subscribers.get('signal')?.delete(handler);
  }

  async connect(remoteId: string) {
    const peer = new WebRTCEndpoint();
    peer.onSignal((to, signal) => this.emitSignal(to, signal));
    peer.onClose(() => this.emitClose(remoteId));
    peer.onError((error) => this.emitError(remoteId, error));
    this.peers.set(remoteId, peer);
    const dc = await peer.connect(remoteId);
    return new WebRTCTransport(dc, peer.maxMessageSize);
  }

  async handleSignal(remoteId: string, signal: TSignal) {
    const signalSchema = z.discriminatedUnion('type', [
      z.object({
        data: z.any(),
        type: z.literal('offer')
      }),
      z.object({
        data: z.any(),
        type: z.literal('answer')
      }),
      z.object({
        data: z.any(),
        type: z.literal('ice')
      })
    ]);
    const result = signalSchema.safeParse(signal);
    if (!result.success) return;
    const parsedSignal = result.data;
    switch (parsedSignal.type) {
      case 'answer': {
        const peer = this.peers.get(remoteId);
        if (!peer) return;
        await peer.acceptAnswer(parsedSignal.data);
        break;
      }
      case 'ice': {
        const peer = this.peers.get(remoteId);
        if (!peer) return;
        peer.addIceCandidate(parsedSignal.data);
        break;
      }
      case 'offer': {
        if (this.peers.has(remoteId)) return;
        const peer = new WebRTCEndpoint();
        peer.onSignal((to, signal) => this.emitSignal(to, signal));
        peer.onClose(() => this.emitClose(remoteId));
        peer.onError((error) => this.emitError(remoteId, error));
        this.peers.set(remoteId, peer);
        const dc = await peer.acceptOffer(remoteId, parsedSignal.data);
        const transport = new WebRTCTransport(dc, peer.maxMessageSize);
        this.emitNewTransport(remoteId, transport);
        break;
      }
    }
  }

  emitNewTransport(remoteId: string, transport: TTransport) {
    const subscribers = this.subscribers.get('transport');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(remoteId, transport);
    }
  }

  emitClose(remoteId: string) {
    const subscribers = this.subscribers.get('close');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(remoteId);
    }
  }

  emitSignal(to: string, signal: object) {
    const subscribers = this.subscribers.get('signal');
    if (!subscribers) return;
    for (const handler of subscribers) {
      handler(to, signal);
    }
  }
}

export const webRTCTransportFactory = new WebRTCTransportFactory();
