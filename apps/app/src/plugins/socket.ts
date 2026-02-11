import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { and, eq, gt, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import {
	SyncServerSocketNewEventsResponseDataSchema,
	SyncServerSocketRequestSchema,
	SyncServerSocketResponseSchema
} from 'proto/event_pb';

import { db } from '~/db/client';
import { receiveMessage } from '~/db/messages';
import * as schema from '~/db/schema';
import { verifyData } from '~/utils/auth';
import { getLocalClock, setLocalClock } from '~/utils/clock';

export const socketPlugin = new Elysia({ serve: { idleTimeout: 120 } }).ws('ws', {
	body: t.Object(
		{
			newEvents: t.Array(
				t.Object({
					accountId: t.String(),
					clientId: t.String(),
					data: t.Uint8Array(),
					signature: t.String()
				})
			),
			timestamp: t.String()
		},
		{ additionalProperties: true }
	),
	async message(ws, body) {
		const clock = await getLocalClock();
		for (const $event of body.newEvents) {
			const { accountId, clientId, data, signature } = $event;
			const verified = verifyData(data, signature, accountId);
			if (!verified) return;

			const syncedAt = clock.increment().toString();
			const event = await db.transaction(async (tx) => {
				const event = await receiveMessage(
					{ accountId, clientId, data: Buffer.from(data), syncedAt },
					tx
				);
				await setLocalClock(clock, tx);
				return event;
			});
			if (event)
				ws.publishBinary(
					`new_events_${accountId}`,
					toBinary(
						SyncServerSocketResponseSchema,
						create(SyncServerSocketResponseSchema, {
							payload: {
								case: 'newEvents',
								value: {
									events: [
										create(SyncServerSocketNewEventsResponseDataSchema, {
											data: event.data,
											syncedAt: event.syncedAt
										})
									],
									id: clock.clientId
								}
							}
						})
					)
				);
		}
		ws.sendBinary(
			toBinary(
				SyncServerSocketResponseSchema,
				create(SyncServerSocketResponseSchema, {
					payload: {
						case: 'gotEvents',
						value: { count: body.newEvents.length, id: clock.clientId, timestamp: body.timestamp }
					}
				})
			)
		);
	},
	async open(ws) {
		const { accountId, clientId, lastSyncedAt } = ws.data.query;
		ws.subscribe(`new_events_${accountId}`);
		const clock = await getLocalClock();
		ws.sendBinary(
			toBinary(
				SyncServerSocketResponseSchema,
				create(SyncServerSocketResponseSchema, {
					payload: { case: 'info', value: { id: clock.clientId } }
				})
			)
		);
		const events = await db
			.select({ data: schema.messages.data, syncedAt: schema.messages.syncedAt })
			.from(schema.messages)
			.where(
				and(
					ne(schema.messages.clientId, clientId),
					gt(schema.messages.syncedAt, lastSyncedAt!).if(lastSyncedAt !== undefined),
					eq(schema.messages.accountId, accountId)
				)
			);
		if (events.length <= 0) return;
		ws.sendBinary(
			toBinary(
				SyncServerSocketResponseSchema,
				create(SyncServerSocketResponseSchema, {
					payload: {
						case: 'newEvents',
						value: {
							events: events.map((event) =>
								create(SyncServerSocketNewEventsResponseDataSchema, {
									data: event.data!,
									syncedAt: event.syncedAt
								})
							),
							id: clock.clientId
						}
					}
				})
			)
		);
	},
	parse: (_ws, message) => {
		return fromBinary(SyncServerSocketRequestSchema, message as Uint8Array);
	},
	query: t.Object({
		accountId: t.String(),
		clientId: t.String(),
		lastSyncedAt: t.Optional(t.String())
	})
});
