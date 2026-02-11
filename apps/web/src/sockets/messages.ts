import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { makeReconnectingWS } from '@solid-primitives/websocket';
import { ethers } from 'ethers';
import {
	EventSchema,
	SyncServerSocketRequestSchema,
	SyncServerSocketResponseSchema
} from 'proto/event_pb';
import { createComputed, createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { AsyncResult, Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import type { TValidEvent } from '~/queries/mutations';

import { useNotifications } from '~/context/notifications';
import { logger } from '~/db/client';
import { account } from '~/signals/account';
import { env } from '~/utils/env';
import { isOnline, pageVisible } from '~/utils/signals';
import { getServerId } from '~/utils/sync-server';
import { decrypt, encrypt } from '~/workers/encryption';

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
const [numberOfSendingChanges, setNumberOfSendingChanges] = createSignal(0);
createEffect(() => {
	if (numberOfSendingChanges() <= 0) {
		removeNotification(pushNotificationId);
		return;
	}
	let message = `Sending ${numberOfSendingChanges()} change`;
	if (numberOfSendingChanges() > 1) message += 's';
	createNotification(message, { id: pushNotificationId });
});
const shouldPoll = createMemo(
	() =>
		isOnline() && pageVisible() && account() !== null && env.VITE_SYNC_SERVER_BASE_URL !== undefined
);
let ws: WebSocket;
let serverId: string | undefined;

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
						{
							const serverId = await getServerId().unwrap();
							const lastSyncedAt = await logger.getLatestReceivedAt(serverId);
							if (lastSyncedAt) {
								searchParams.set('lastSyncedAt', lastSyncedAt);
							}
						}

						const socketUrl = `${env.VITE_SYNC_SERVER_BASE_URL!.replace('http', 'ws')}/api/v1/ws?${searchParams.toString()}`;

						ws = makeReconnectingWS(socketUrl);
						ws.addEventListener('open', () => {
							console.debug('[WS] Connected');
						});

						const onMessage = (event: MessageEvent) =>
							AsyncResult.from(
								async function () {
									const { payload } = fromBinary(
										SyncServerSocketResponseSchema,
										new Uint8Array(await event.data.arrayBuffer())
									);
									switch (payload.case) {
										case 'gotEvents': {
											await logger.setLatestSentAt(payload.value.id, payload.value.timestamp);
											setNumberOfSendingChanges((value) => value - payload.value.count);
											pushPendingEvents().unwrap();
											break;
										}
										case 'info': {
											serverId = payload.value.id;
											pushPendingEvents().unwrap();
											break;
										}
										case 'newEvents': {
											createNotification('Receiving changes', { id: pullNotificationId });
											const aesKey = await window.crypto.subtle.importKey(
												'jwk',
												account()!.aesKey,
												{ name: 'AES-GCM' },
												true,
												['encrypt', 'decrypt']
											);
											const decryptedEvents = await Promise.all(
												payload.value.events.map(async ({ data, syncedAt }) => {
													const decryptedEvent = await decrypt(data, aesKey);
													const deserialzedEvent = fromBinary(EventSchema, decryptedEvent);
													const parsedEvent = {
														type: deserialzedEvent.data!.eventType.case!,
														data: deserialzedEvent.data!.eventType.value!,
														timestamp: deserialzedEvent.timestamp,
														version: deserialzedEvent.version
													} as TValidEvent & { timestamp: string; version: string };
													// @ts-expect-error: $typeName is not in the type definition
													delete parsedEvent.data['$typeName'];
													return Object.assign(parsedEvent, { syncedAt });
												})
											);
											updateNotification(
												pullNotificationId,
												`Receiving ${payload.value.events.length} changes`
											);
											const invalidate = await logger.receive(payload.value.id, decryptedEvents);
											await invalidate();
											removeNotification(pullNotificationId);
											console.debug(`[WS Pull] Got ${payload.value.events.length} events`);
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

const pushPendingEvents = () =>
	tryBlock(
		async function* () {
			const $account = account();
			if ($account === null) return;
			if (!ws) return;
			if (ws.readyState !== 1) return;
			if (!serverId) return;
			const clientId = yield* Option.from(logger.getMetadata('clientId')).okOrElse(
				() => new Error('Missing clientId in local database metadata')
			);
			const { events } = await logger.getUnsyncedEvents(serverId);
			console.debug('[WS Push] Found', events.length, 'events to push');
			if (!events.length) return;
			setNumberOfSendingChanges(events.length);
			const aesKey = await window.crypto.subtle.importKey(
				'jwk',
				$account.aesKey,
				{ name: 'AES-GCM' },
				true,
				['encrypt', 'decrypt']
			);
			const wallet = new ethers.Wallet($account.privateKey);
			const newEvents = await Promise.all(
				events.map(async (event) => {
					const serializedEvent = toBinary(
						EventSchema,
						create(EventSchema, {
							timestamp: event.timestamp,
							version: event.version,
							data: {
								eventType: {
									case: event.type as never,
									value: event.data as never
								}
							}
						})
					);
					const encryptedEvent = await encrypt(serializedEvent, aesKey);
					const signature = await wallet.signMessage(encryptedEvent);
					return {
						accountId: $account.id,
						clientId: clientId ?? undefined,
						signature,
						data: encryptedEvent
					};
				})
			);
			ws.send(
				toBinary(
					SyncServerSocketRequestSchema,
					create(SyncServerSocketRequestSchema, { newEvents, timestamp: events.at(-1)!.timestamp })
				)
			);
		},
		(e) => new Error(`Error while pushing pending events`, { cause: e })
	);

export { initSocket, pushPendingEvents as pushPendingMessages };
