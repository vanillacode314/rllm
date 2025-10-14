import { makeReconnectingWS } from '@solid-primitives/websocket';
import { type } from 'arktype';
import { and, gt, like } from 'drizzle-orm';
import { ethers } from 'ethers';
import { createComputed, createMemo, untrack } from 'solid-js';
import { AsyncResult, Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { useNotifications } from '~/context/notifications';
import { db } from '~/db/client';
import { logger } from '~/db/client';
import * as schema from '~/db/schema';
import { account } from '~/signals/account';
import { env } from '~/utils/env';
import { queryClient } from '~/utils/query-client';
import { isOnline, pageVisible } from '~/utils/signals';
import { optimizeMessages } from '~/utils/storage';
import { encryptionWorkerPool } from '~/workers/encryption';

const [notifications, { createNotification, removeNotification, updateNotification }] =
	useNotifications();

const pushNotificationId = 'PUSH';
const pullNotificationId = 'PULL';
const isPending = createMemo(() =>
	notifications.some(
		(notification) =>
			notification.id === pushNotificationId || notification.id === pullNotificationId
	)
);
const shouldPoll = createMemo(
	() =>
		isOnline() && pageVisible() && account() !== null && env.VITE_SYNC_SERVER_BASE_URL !== undefined
);
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

const initSocket = () =>
	tryBlock<Error>(
		async function* () {
			const clientId = yield* Option.from(await logger.getMetadata('clientId')).okOrElse(
				() => new Error('Missing clientId in local database metadata')
			);

			const setupWs = () =>
				AsyncResult.from(
					async function () {
						if (ws && ws.readyState < 2) return;
						const searchParams = new URLSearchParams();
						searchParams.set('clientId', clientId);
						searchParams.set('accountId', account()!.id);
						const lastSyncedAt = await logger.getMetadata('lastPullAt');
						if (lastSyncedAt) {
							searchParams.set('lastSyncedAt', lastSyncedAt);
						}

						const socketUrl = `${env.VITE_SYNC_SERVER_BASE_URL!.replace('http', 'ws')}/api/v1/ws?${searchParams.toString()}`;

						ws = makeReconnectingWS(socketUrl);
						ws.addEventListener('open', () => {
							console.debug('[WS] Connected');
							pushPendingMessages().unwrap();
						});

						const onMessage = (event: MessageEvent) =>
							AsyncResult.from(
								async function () {
									const result = websocketMessageSchema.assert(event.data);
									if (result instanceof type.errors) {
										console.error('[WS Error]', result.summary);
										return;
									}
									switch (result.type) {
										case 'got_messages': {
											const lastPushAt = await logger.getMetadata('lastPushAt');
											if (lastPushAt && result.timestamp > lastPushAt) {
												await logger.setMetadata('lastPushAt', result.timestamp);
											}
											removeNotification(pushNotificationId);
											break;
										}
										case 'new_messages': {
											createNotification('Receiving changes', { id: pullNotificationId });
											const aesKey = await window.crypto.subtle.importKey(
												'jwk',
												account()!.aesKey,
												{ name: 'AES-GCM' },
												true,
												['encrypt', 'decrypt']
											);
											const decryptedMessages = await Promise.all(
												result.messages.map(async ({ data, syncedAt }) => {
													const worker = await encryptionWorkerPool.get();
													data = await worker
														.decrypt(data, aesKey)
														.finally(() => encryptionWorkerPool.release(worker));
													const messages = schema.eventSchema.array().assert(JSON.parse(data));
													return messages.map((message) => Object.assign(message, { syncedAt }));
												})
											);
											updateNotification(
												pullNotificationId,
												`Receiving ${result.messages.length} messages`
											);
											const toInvalidate = await logger.receive(decryptedMessages.flat());
											await Promise.all(
												toInvalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey }))
											);
											removeNotification(pullNotificationId);
											console.debug(`[WS Pull] Got ${result.messages.length} messages`);
											break;
										}
									}
								},
								(e) => new Error(`Error while handling websocket message`, { cause: e })
							);
						ws.addEventListener('message', (e) => onMessage(e).unwrap());
					},
					(e) => new Error(`Error while setting up websocket`, { cause: e })
				);
			createComputed(() => {
				const $shouldPoll = shouldPoll();
				const $isPending = isPending();
				untrack(() => {
					if (!$shouldPoll) {
						console.debug('[WS] Offline');

						if ($isPending) return;
						if (ws && ws.readyState < 2) ws.close();

						return;
					}
					console.debug('[WS] Online');
					setupWs().unwrap();
				});
			});
		},
		(e) => new Error(`Error while initializing websocket`, { cause: e })
	);

const pushPendingMessages = () =>
	tryBlock(
		async function* () {
			if (account() === null) return;
			if (!ws) return;
			if (ws.readyState !== 1) return;
			const lastPushAt = await logger.getMetadata('lastPushAt');
			const clientId = yield* Option.from(logger.getMetadata('clientId')).okOrElse(
				() => new Error('Missing clientId in local database metadata')
			);
			const accountId = account()!.id;
			const messages = await db
				.select()
				.from(schema.events)
				.where(
					and(
						gt(schema.events.timestamp, lastPushAt!).if(lastPushAt),
						like(schema.events.timestamp, `%${clientId}`)
					)
				);
			if (!messages.length) return;
			console.debug('[WS Push] Found', messages.length, 'messages to push');
			createNotification(`Sending ${messages.length} changes`, { id: pushNotificationId });
			const aesKey = await window.crypto.subtle.importKey(
				'jwk',
				account()!.aesKey,
				{ name: 'AES-GCM' },
				true,
				['encrypt', 'decrypt']
			);
			const worker = await encryptionWorkerPool.get();
			const data = await worker
				.encrypt(JSON.stringify(messages), aesKey)
				.finally(() => encryptionWorkerPool.release(worker));
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
		},
		(e) => new Error(`Error while pushing pending messages`, { cause: e })
	);

export { initSocket, pushPendingMessages };
