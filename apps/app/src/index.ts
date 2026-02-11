import { create, toBinary } from '@bufbuild/protobuf';
import cors from '@elysiajs/cors';
import serverTiming from '@elysiajs/server-timing';
import { swagger } from '@elysiajs/swagger';
import { and, asc, eq, gt, gte, lte, ne } from 'drizzle-orm';
import { Elysia, t } from 'elysia';
import { SyncServerGetEventsResponseSchema } from 'proto/event_pb';

import { db } from './db/client';
import { receiveMessage } from './db/messages';
import * as schema from './db/schema';
import { authPlugin } from './plugins/auth';
import { socketPlugin } from './plugins/socket';
import { verifyData } from './utils/auth';
import { getLocalClock, setLocalClock } from './utils/clock';
import { env } from './utils/env';

const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_PORT = 3000;

const app = new Elysia({ prefix: '/api/v1' })
	.use(serverTiming())
	.use(cors())
	.use(authPlugin)
	.use(swagger())
	.use(socketPlugin)
	.post(
		'messages',
		async ({ body, status, token }) => {
			if (token.accountId !== body.accountId) return status(401, 'Unauthorized');
			const { accountId, clientId, data, signature } = body;
			const verified = verifyData(data, signature, token.accountId);
			if (!verified) return status(401, 'Unauthorized');
			const clock = await getLocalClock();
			const syncedAt = clock.increment().toString();
			const message = await db.transaction(async (tx) => {
				const message = await receiveMessage(
					{ accountId, clientId, data: Buffer.from(data), syncedAt },
					tx
				);
				await setLocalClock(clock, tx);
				return message;
			});
			if (!message) throw new Error('Failed to receive message');
			return { timestamp: syncedAt };
		},
		{
			auth: true,
			body: t.Object({
				accountId: t.String(),
				clientId: t.String(),
				data: t.Uint8Array(),
				signature: t.String()
			}),
			response: {
				200: t.Object({ timestamp: t.String() }),
				401: t.Literal('Unauthorized')
			}
		}
	)
	.delete(
		'account',
		async ({ body, status, token }) => {
			if (token.accountId !== body.accountId) return status(401, 'Unauthorized');
			await db.delete(schema.messages).where(eq(schema.messages.accountId, body.accountId));
			return status(202, 'Accepted');
		},
		{
			auth: true,
			body: t.Object({ accountId: t.String() }),
			response: {
				202: t.Literal('Accepted'),
				401: t.Literal('Unauthorized')
			}
		}
	)
	.delete(
		'messages',
		async ({ body, status, token }) => {
			if (token.accountId !== body.accountId) return status(401, {});
			const { accountId, after, before, clientId } = body;
			await db
				.delete(schema.messages)
				.where(
					and(
						eq(schema.messages.accountId, accountId),
						eq(schema.messages.clientId, clientId!).if(clientId),
						gte(schema.messages.syncedAt, after!).if(after),
						lte(schema.messages.syncedAt, before!).if(before)
					)
				);
			return status(202);
		},
		{
			auth: true,
			body: t.Object({
				accountId: t.String(),
				after: t.Optional(t.String()),
				before: t.Optional(t.String()),
				clientId: t.Optional(t.String())
			})
		}
	)
	.get(
		'messages',
		async ({ query }) => {
			const { accountId, after, clientId, pageSize = DEFAULT_PAGE_SIZE } = query;
			const events = await db
				.select({ data: schema.messages.data, syncedAt: schema.messages.syncedAt })
				.from(schema.messages)
				.where(
					and(
						eq(schema.messages.accountId, accountId),
						ne(schema.messages.clientId, clientId!).if(clientId),
						gt(schema.messages.syncedAt, after!).if(after)
					)
				)
				.orderBy(asc(schema.messages.syncedAt))
				.limit(pageSize + 1);

			const hasMore = events.length > pageSize;
			const nextAfter = hasMore && events.pop() ? events[events.length - 1].syncedAt : undefined;

			return toBinary(
				SyncServerGetEventsResponseSchema,
				create(SyncServerGetEventsResponseSchema, {
					events: events.map((event) => ({
						data: new Uint8Array(event.data),
						syncedAt: event.syncedAt
					})),
					hasMore,
					nextAfter,
					pageSize
				})
			);
		},
		{
			query: t.Object({
				accountId: t.String({ minLength: 1 }),
				after: t.Optional(t.Nullable(t.String({ minLength: 1 }))),
				clientId: t.Optional(t.String({ minLength: 1 })),
				pageSize: t.Optional(t.Number({ maxLength: 100, minLength: 1 }))
			})
		}
	)
	.get(
		'messages/stream',
		function ({ query }) {
			return new Response(
				new ReadableStream({
					async start(controller) {
						const { accountId, after, clientId, pageSize = DEFAULT_PAGE_SIZE } = query;
						let hasMore = false;
						let nextAfter = after ?? undefined;

						do {
							const events = await db
								.select({ data: schema.messages.data, syncedAt: schema.messages.syncedAt })
								.from(schema.messages)
								.where(
									and(
										eq(schema.messages.accountId, accountId),
										ne(schema.messages.clientId, clientId!).if(clientId),
										gt(schema.messages.syncedAt, nextAfter!).if(nextAfter)
									)
								)
								.orderBy(asc(schema.messages.syncedAt))
								.limit(pageSize + 1);

							hasMore = events.length > pageSize;
							nextAfter = hasMore && events.pop() ? events[events.length - 1].syncedAt : undefined;

							const messageBytes = toBinary(
								SyncServerGetEventsResponseSchema,
								create(SyncServerGetEventsResponseSchema, {
									events: events.map((event) => ({
										data: new Uint8Array(event.data),
										syncedAt: event.syncedAt
									})),
									hasMore,
									nextAfter,
									pageSize
								})
							);
							const header = new Uint8Array(4);
							new DataView(header.buffer).setUint32(0, messageBytes.length, true);
							controller.enqueue(header);
							controller.enqueue(messageBytes);
						} while (hasMore);
						controller.close();
					}
				})
			);
		},
		{
			query: t.Object({
				accountId: t.String({ minLength: 1 }),
				after: t.Optional(t.Nullable(t.String({ minLength: 1 }))),
				clientId: t.Optional(t.String({ minLength: 1 })),
				pageSize: t.Optional(t.Number({ maxLength: 100, minLength: 1 }))
			})
		}
	)
	.get('id', async () => {
		const clock = await getLocalClock();
		return clock.clientId;
	})
	.listen(process.env.PORT || DEFAULT_PORT);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port} using database at ${env.DATABASE_CONNECTION_URL}`
);
