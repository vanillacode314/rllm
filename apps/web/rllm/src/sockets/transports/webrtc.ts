import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import * as PeerPB from 'proto/peers/v1/peer_pb';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import { logger } from '~/db/client';
import { account } from '~/signals/account';

import { ConnectionManager, type TTransport } from '../messages';
import { createPeerSocket } from '../utils';

interface TPeerState {
  connection: ConnectionManager | null;
  dc: null | RTCDataChannel;
  pc: RTCPeerConnection;
  pendingCandidates: RTCIceCandidate[];
}

const PEERS = new Map<string, TPeerState>();
export class WebRTCTransport implements TTransport {
  get ready() {
    return this.dc.readyState === 'open';
  }

  constructor(readonly dc: RTCDataChannel) {}

  close() {
    this.dc.close();
  }

  onmessage(fn: (data: Uint8Array<ArrayBuffer>) => void) {
    const handler = (e: MessageEvent) => fn(new Uint8Array(e.data));
    this.dc.addEventListener('message', handler);
    return () => this.dc.removeEventListener('message', handler);
  }

  send(data: Uint8Array<ArrayBuffer>) {
    this.dc.send(data);
  }
}

export async function initWebRTCTransport() {
  const clientId = Option.from(await logger.getMetadata('clientId'))
    .okOrElse(() => new Error('Missing clientId in local database metadata'))
    .unwrap();
  const $account = account();
  if ($account === null) return;
  const accountId = $account.id;

  const ws = createPeerSocket(clientId, accountId, true);
  const signalSchema = z.discriminatedUnion('type', [
    z.object({
      offer: z.any(),
      type: z.literal('offer')
    }),
    z.object({
      answer: z.any(),
      type: z.literal('answer')
    }),
    z.object({
      candidate: z.any(),
      type: z.literal('ice')
    })
  ]);

  function sendRemovePeer(peerId: string) {
    ws.send(
      toBinary(
        PeerPB.SyncWireMessageSchema,
        create(PeerPB.SyncWireMessageSchema, {
          accountId: $account!.id,
          clientId,
          payload: {
            case: 'removePeer',
            value: { peerId }
          }
        })
      )
    );
  }

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

  async function handleSignal(remoteId: string, signal: z.output<typeof signalSchema>) {
    switch (signal.type) {
      case 'answer': {
        const peer = PEERS.get(remoteId);
        if (!peer) return;
        const { pc, pendingCandidates } = peer;
        await pc.setRemoteDescription(signal.answer);
        while (pendingCandidates.length > 0) {
          const candidate = pendingCandidates.shift();
          // oxlint-disable-next-line no-await-in-loop
          await pc.addIceCandidate(candidate);
        }
        break;
      }
      case 'ice': {
        const peer = PEERS.get(remoteId);
        if (!peer) return;
        const { pc, pendingCandidates } = peer;
        if (pc.remoteDescription) {
          await pc.addIceCandidate(signal.candidate);
        } else {
          pendingCandidates.push(signal.candidate);
        }
        break;
      }
      case 'offer': {
        if (PEERS.has(remoteId)) return;
        const answer = await createAnswer(remoteId, signal.offer);
        sendSignal(remoteId, { answer, type: 'answer' });
        console.debug(`[WebRTC] sent answer to "${remoteId}"`);
        break;
      }
      default:
        console.error('Unknown signal type:', signal);
    }
  }

  async function handleNewPeer(remoteId: string) {
    if (remoteId === clientId) return;
    if (PEERS.has(remoteId)) return;

    const offer = await createOffer(remoteId);
    sendSignal(remoteId, { offer, type: 'offer' });
    console.debug(`[WebRTC] sent offer to "${remoteId}"`);
  }

  async function createAnswer(remoteId: string, offer: RTCSessionDescriptionInit) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.error(`[WebRTC] connection failed with "${remoteId}"`);
        cleanup(remoteId);
      }
      if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            console.error(`[WebRTC] connection disconnected with "${remoteId}"`);
            cleanup(remoteId);
          }
        }, 3000);
      }
    };
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      sendSignal(remoteId, { candidate, type: 'ice' });
    };
    const peer = {
      connection: null,
      dc: null,
      pc,
      pendingCandidates: []
    } satisfies TPeerState;
    PEERS.set(remoteId, peer);
    pc.ondatachannel = (e) => {
      const dc = e.channel;
      console.debug(`[WebRTC] connected to "${remoteId}"`);
      const transport = new WebRTCTransport(dc);
      const connection = new ConnectionManager(accountId, clientId, transport, 'WebRTC');
      Object.assign(peer, { connection, dc });
      connection.init();
      ws.send(connection.createAddPeer(remoteId));
    };

    await pc.setRemoteDescription(offer);
    while (peer.pendingCandidates.length > 0) {
      const candidate = peer.pendingCandidates.shift();
      // oxlint-disable-next-line no-await-in-loop
      await pc.addIceCandidate(candidate);
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer;
  }

  function cleanup(peerId: string) {
    const peer = PEERS.get(peerId);
    if (!peer) return;
    try {
      peer.dc?.close();
    } catch {}
    peer.pc.close();
    sendRemovePeer(peerId);
  }

  async function createOffer(remoteId: string) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
    const dc = pc.createDataChannel('sync');

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.error(`[WebRTC] connection failed with "${remoteId}"`);
        cleanup(remoteId);
      }
      if (pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'disconnected') {
            console.error(`[WebRTC] connection disconnected with "${remoteId}"`);
            cleanup(remoteId);
          }
        }, 3000);
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      sendSignal(remoteId, { candidate, type: 'ice' });
    };
    const peer: TPeerState = {
      connection: null,
      dc,
      pc,
      pendingCandidates: []
    };
    PEERS.set(remoteId, peer);

    dc.onopen = () => {
      console.debug(`[WebRTC] connected to "${remoteId}"`);
      const transport = new WebRTCTransport(dc);
      const connection = new ConnectionManager(accountId, clientId, transport, 'WebRTC');
      connection.init();
      peer.connection = connection;
      ws.send(connection.createAddPeer(remoteId));
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    return offer;
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
      case 'peerConnected': {
        const remoteId = body.payload.value.clientId;
        console.debug(`[WebRTC] new peer connected "${remoteId}"`);
        handleNewPeer(remoteId);
        break;
      }
      case 'webrtcSignal': {
        const remoteId = body.clientId;
        const data = safeParseJson(body.payload.value.data, {
          validate: signalSchema.parse
        }).expect('Invalid data');
        console.debug(`[WebRTC] got signal(${data.type}) from "${remoteId}"`);
        handleSignal(remoteId, data);
        break;
      }
    }
  });
}
