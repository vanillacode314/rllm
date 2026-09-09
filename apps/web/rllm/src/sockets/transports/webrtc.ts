import { Event } from 'event-bus';
import * as z from 'zod/mini';

import type { TSignal, TTransport, TTransportFactory } from '.';

class WebRTCEndpoint {
  #closeEvent = new Event<void>();
  onClose = this.#closeEvent.subscribe.bind(this.#closeEvent);
  #errorEvent = new Event<void>();
  onError = this.#errorEvent.subscribe.bind(this.#errorEvent);
  #signalEvent = new Event<{ remoteId: string; signal: TSignal }>();

  onSignal = this.#signalEvent.subscribe.bind(this.#signalEvent);
  get maxMessageSize() {
    return this.#pc.sctp?.maxMessageSize;
  }
  #pc = new RTCPeerConnection();

  #pendingIceCandidates = new Array<RTCIceCandidate>();
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
      this.#signalEvent.emit({ remoteId: id, signal: { data: candidate, type: 'ice' } });
    };
    this.#pc.onconnectionstatechange = () => {
      if (this.#pc.connectionState === 'closed') {
        this.#closeEvent.emit();
        return;
      }
      if (this.#pc.connectionState === 'failed') {
        this.#errorEvent.emit();
        return;
      }
      if (this.#pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (this.#pc.connectionState === 'disconnected') {
            this.#closeEvent.emit();
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
    this.#signalEvent.emit({ remoteId: id, signal: { data: answer, type: 'answer' } });
    return promise;
  }
  async addIceCandidate(candidate: RTCIceCandidate) {
    if (this.#pc.remoteDescription) {
      await this.#pc.addIceCandidate(candidate);
    } else {
      this.#pendingIceCandidates.push(candidate);
    }
  }
  async connect(id: string) {
    const { promise, reject, resolve } = Promise.withResolvers<RTCDataChannel>();
    const dc = this.#pc.createDataChannel('sync');
    this.#pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      this.#signalEvent.emit({ remoteId: id, signal: { data: candidate, type: 'ice' } });
    };
    this.#pc.onconnectionstatechange = () => {
      if (this.#pc.connectionState === 'closed') {
        this.#closeEvent.emit();
        return;
      }
      if (this.#pc.connectionState === 'failed') {
        this.#errorEvent.emit();
        return;
      }
      if (this.#pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (this.#pc.connectionState === 'disconnected') {
            this.#closeEvent.emit();
          }
        }, 2000);
        return;
      }
    };
    dc.onopen = () => resolve(dc);
    dc.onerror = reject;
    const offer = await this.#pc.createOffer();
    this.#pc.setLocalDescription(offer);
    this.#signalEvent.emit({ remoteId: id, signal: { data: offer, type: 'offer' } });
    return promise;
  }
}

class WebRTCTransport implements TTransport {
  get id() {
    return 'WebRTC';
  }
  get ready() {
    return this.dc.readyState === 'open';
  }

  #messageEvent = new Event<Uint8Array<ArrayBuffer>>();

  #started = false;

  constructor(
    private readonly dc: RTCDataChannel,
    private readonly maxMessageSize: number = 16384
  ) {}

  close() {
    this.dc.close();
  }

  onMessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const unsubscribe = this.#messageEvent.subscribe(fn);
    this.startReadLoop();
    return unsubscribe;
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

  async startReadLoop() {
    if (this.#started) return;
    this.#started = true;

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
      this.#messageEvent.emit(message);
    }
  }
}

class WebRTCTransportFactory implements TTransportFactory {
  #closeEvent = new Event<string>();
  onClose = this.#closeEvent.subscribe.bind(this.#closeEvent);
  #errorEvent = new Event<{ error: unknown; remoteId: string }>();
  onError = this.#errorEvent.subscribe.bind(this.#errorEvent);
  #newTransportEvent = new Event<{ remoteId: string; transport: TTransport }>();

  onNewTransport = this.#newTransportEvent.subscribe.bind(this.#newTransportEvent);

  #signalEvent = new Event<{ remoteId: string; signal: TSignal }>();

  onSignal = this.#signalEvent.subscribe.bind(this.#signalEvent);
  get id() {
    return 'WebRTC';
  }
  #peers = new Map<string, WebRTCEndpoint>();
  async connect(remoteId: string) {
    const peer = new WebRTCEndpoint();
    peer.onSignal((payload) => this.#signalEvent.emit(payload));
    peer.onClose(() => this.#closeEvent.emit(remoteId));
    peer.onError((error) => this.#errorEvent.emit({ error, remoteId }));
    this.#peers.set(remoteId, peer);
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
        const peer = this.#peers.get(remoteId);
        if (!peer) return;
        await peer.acceptAnswer(parsedSignal.data);
        break;
      }
      case 'ice': {
        const peer = this.#peers.get(remoteId);
        if (!peer) return;
        peer.addIceCandidate(parsedSignal.data);
        break;
      }
      case 'offer': {
        if (this.#peers.has(remoteId)) return;
        const peer = new WebRTCEndpoint();
        peer.onSignal((payload) => this.#signalEvent.emit(payload));
        peer.onClose(() => this.#closeEvent.emit(remoteId));
        peer.onError((error) => this.#errorEvent.emit({ error, remoteId }));
        this.#peers.set(remoteId, peer);
        const dc = await peer.acceptOffer(remoteId, parsedSignal.data);
        const transport = new WebRTCTransport(dc, peer.maxMessageSize);
        this.#newTransportEvent.emit({ remoteId, transport });
        break;
      }
    }
  }

  ready = () => Promise.resolve();
}

export const webRTCTransportFactory = new WebRTCTransportFactory();
