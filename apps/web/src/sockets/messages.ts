import { makeReconnectingWS } from '@solid-primitives/websocket';
import { type } from 'arktype';
import { and, gt, like } from 'drizzle-orm';
import { ethers } from 'ethers';
import { createComputed, untrack } from 'solid-js';

import { db } from '~/db/client';
import * as schema from '~/db/schema';
import { account } from '~/signals/account';
import { decryptDataWithKey, encryptDataWithKey } from '~/utils/crypto';
import { getMetadata, setMetadata } from '~/utils/db';
import { env } from '~/utils/env';
import { receiveMessages } from '~/utils/messages';
import { queryClient } from '~/utils/query-client';
import { isOnline, pageVisible } from '~/utils/signals';
import { optimizeMessages } from '~/utils/storage';

const shouldPoll = () =>
	isOnline() && pageVisible() && account() !== null && env.VITE_SYNC_SERVER_BASE_URL !== undefined;
const websocketMessageSchema = type('string.json.parse').pipe(
	type({
		type: "'new_messages'",
		messages: [{ data: 'string', syncedAt: 'string' }, '[]'],
		timestamp: 'string'
	}).or({
		type: "'got_messages'",
		timestamp: 'string'
	})
);
let ws: WebSocket;

async function initSocket() {
	const clientId = await getMetadata('clientId');
	if (!clientId) throw new Error('Missing clientId in local database metadata');

	async function setupWs() {
		if (ws && ws.readyState < 2) return;
		const searchParams = new URLSearchParams();
		searchParams.set('clientId', clientId!);
		searchParams.set('accountId', account()!.id);
		const lastSyncedAt = await getMetadata('lastPullAt');
		if (lastSyncedAt) searchParams.set('lastSyncedAt', lastSyncedAt);

		const socketUrl = `${env.VITE_SYNC_SERVER_BASE_URL!.replace('http', 'ws')}/api/v1/ws?${searchParams.toString()}`;

		ws = makeReconnectingWS(socketUrl);
		ws.addEventListener('open', () => {
			console.debug('[WS] Connected');
			pushPendingMessages();
		});

		ws.addEventListener('message', async (event) => {
			const result = websocketMessageSchema.assert(event.data);
			if (result instanceof type.errors) {
				console.error('[WS Error]', result.summary);
				return;
			}
			switch (result.type) {
				case 'got_messages': {
					const lastPushAt = (await getMetadata('lastPushAt')) ?? null;
					if (lastPushAt === null || result.timestamp > lastPushAt) {
						await setMetadata('lastPushAt', result.timestamp);
					}
					break;
				}
				case 'new_messages': {
					try {
						const aesKey = await window.crypto.subtle.importKey(
							'jwk',
							account()!.aesKey,
							{ name: 'AES-GCM' },
							true,
							['encrypt', 'decrypt']
						);
						const decryptedMessages = await Promise.all(
							result.messages.map(async ({ data, syncedAt }) => {
								data = await decryptDataWithKey(data, aesKey);
								const messages = schema.messagesSchema.array().assert(JSON.parse(data));
								return messages.map((message) => Object.assign(message, { syncedAt }));
							})
						);
						await receiveMessages(await optimizeMessages(decryptedMessages.flat()));
						console.debug(`[WS Pull] Got ${result.messages.length} messages`);
						await queryClient.invalidateQueries();
					} catch (error) {
						console.error('[WS Pull Error]', error);
					}
					break;
				}
			}
		});
	}

	createComputed(() => {
		const $shouldPoll = shouldPoll();
		untrack(() => {
			if (!$shouldPoll) {
				console.debug('[WS] Offline');
				if (ws && ws.readyState < 2) ws.close();
				return;
			}
			console.debug('[WS] Online');
			setupWs();
		});
	});
}

async function pushPendingMessages() {
	if (account() === null) return;
	if (!ws) return;
	if (ws.readyState !== 1) return;
	const lastPushAt = (await getMetadata('lastPushAt')) ?? null;
	const clientId = await getMetadata('clientId');
	const accountId = account()!.id;
	if (!clientId) throw new Error('Missing clientId in local database metadata');
	const messages = await db
		.select()
		.from(schema.messages)
		.where(
			and(
				gt(schema.messages.timestamp, lastPushAt!).if(lastPushAt !== null),
				like(schema.messages.timestamp, `%${clientId}`)
			)
		);
	if (!messages.length) return;
	console.debug('[WS Push] Found', messages.length, 'messages to push');
	const aesKey = await window.crypto.subtle.importKey(
		'jwk',
		account()!.aesKey,
		{ name: 'AES-GCM' },
		true,
		['encrypt', 'decrypt']
	);
	const data = await encryptDataWithKey(JSON.stringify(messages), aesKey);
	const wallet = new ethers.Wallet(account()!.privateKey);
	const signature = await wallet.signMessage(data);
	ws.send(
		JSON.stringify({
			type: 'new_messages',
			data,
			signature,
			clientId,
			accountId
		})
	);
}

export { initSocket, pushPendingMessages };
