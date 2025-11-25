import cors from '@elysiajs/cors';
import { cron } from '@elysiajs/cron';
import serverTiming from '@elysiajs/server-timing';
import { swagger } from '@elysiajs/swagger';
import { type } from 'arktype';
import crypto from 'crypto';
import { and, asc, eq, gt, gte, lte, ne } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { ethers } from 'ethers';

import { db } from './db/client';
import { receiveMessage } from './db/messages';
import * as schema from './db/schema';
import { getLocalClock, setLocalClock } from './utils/clock';
import { getMetadata } from './utils/db';
import { env } from './utils/env';

const CHALLENGES = new Map<string, { expires: number; nonce: string }>();
const TOKENS = new Map<string, { accountId: string; expires: number }>();

const CHALLENGE_EXPIRY_MS = 1000 * 60 * 2;
const TOKEN_EXPIRY_MS = 1000 * 60 * 5;
const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_PORT = 3000;
const AUTH_HEADER_PREFIX_LENGTH = 7;

const auth = new Elysia({ name: 'auth' }).macro({
	auth: {
		async resolve({ request, status }) {
			const token = request.headers.get('authorization')?.slice(AUTH_HEADER_PREFIX_LENGTH);
			if (!token) return status(401);
			const tokenData = TOKENS.get(token);
			if (!tokenData) return status(401);
			if (tokenData.expires < Date.now()) {
				TOKENS.delete(token);
				return status(401);
			}
			return { token: tokenData };
		}
	}
});

const verifyData = (data: string, signature: string, accountId: string) => {
	const recoveredAccountId = ethers.verifyMessage(data, signature);
	return recoveredAccountId === accountId;
};

const app = new Elysia({ serve: { idleTimeout: 120 } })
	.use(serverTiming())
	.use(cors())
	.use(auth)
	.use(swagger())
	.use(
		cron({
			name: 'cleanup',
			pattern: '0 * * * * *',
			run() {
				CHALLENGES.forEach((value, key) => {
					if (value.expires < Date.now()) {
						CHALLENGES.delete(key);
					}
				});
				TOKENS.forEach((value, key) => {
					if (value.expires < Date.now()) {
						TOKENS.delete(key);
					}
				});
			}
		})
	)
	.get(
		'/api/v1/auth/requestChallenge',
		({ query }) => {
			const nonce = crypto.randomBytes(32).toString('hex');
			const expires = Date.now() + CHALLENGE_EXPIRY_MS;
			CHALLENGES.set(query.accountId, { expires, nonce });
			return { nonce };
		},
		{
			query: type({
				accountId: 'string'
			})
		}
	)
	.post(
		'/api/v1/auth/verifyChallenge',
		async ({ body, status }) => {
			const { accountId, nonce, signature } = body;
			const challenge = CHALLENGES.get(accountId);
			if (!challenge) return status(401, {});
			if (challenge.nonce !== nonce) {
				CHALLENGES.delete(accountId);
				return status(401, {});
			}
			if (challenge.expires < Date.now()) {
				CHALLENGES.delete(accountId);
				return status(401, {});
			}
			const verified = verifyData(nonce, signature, accountId);
			if (!verified) {
				CHALLENGES.delete(accountId);
				return status(401, {});
			}
			const token = crypto.randomBytes(32).toString('hex');
			TOKENS.set(token, { accountId, expires: Date.now() + TOKEN_EXPIRY_MS });
			return { token };
		},
		{
			body: type({
				accountId: 'string',
				nonce: 'string',
				signature: 'string'
			}),
			response: {
				200: type({
					token: 'string'
				}),
				401: type({})
			}
		}
	)
	.post(
		'/api/v1/messages',
		async ({ body, status, token }) => {
			if (token.accountId !== body.accountId) return status(401, 'Unauthorized');
			const { accountId, clientId, data, signature } = body;
			const verified = verifyData(data, signature, token.accountId);
			if (!verified) return status(401, 'Unauthorized');
			const clock = await getLocalClock();
			const syncedAt = clock.increment().toString();
			const message = await db.transaction(async (tx) => {
				const message = await receiveMessage({ accountId, clientId, data, syncedAt }, tx);
				await setLocalClock(clock, tx);
				return message;
			});
			if (!message) throw new Error('Failed to receive message');
			return { timestamp: syncedAt };
		},
		{
			auth: true,
			body: type({
				accountId: 'string',
				clientId: 'string',
				data: 'string',
				signature: 'string'
			}),
			response: {
				200: type({ timestamp: 'string' }),
				401: type('"Unauthorized"')
			}
		}
	)
	.delete(
		'/api/v1/account',
		async ({ body, status, token }) => {
			if (token.accountId !== body.accountId) return status(401, 'Unauthorized');
			const { accountId } = body;
			await db.delete(schema.messages).where(eq(schema.messages.accountId, accountId));
			return status(202, 'Accepted');
		},
		{
			auth: true,
			body: type({ accountId: 'string' }),
			response: {
				202: type('"Accepted"'),
				401: type('"Unauthorized"')
			}
		}
	)
	.delete(
		'/api/v1/messages',
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
			body: type({
				accountId: 'string',
				'after?': 'string | undefined',
				'before?': 'string | undefined',
				'clientId?': 'string'
			})
		}
	)
	.get(
		'/api/v1/messages',
		async ({ query }) => {
			const { accountId, after, clientId, pageSize = DEFAULT_PAGE_SIZE } = query;
			const messages = await db
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

			const hasMore = messages.length > pageSize;
			const nextAfter = hasMore && messages.pop() ? messages[messages.length - 1].syncedAt : null;

			return {
				hasMore,
				messages,
				nextAfter,
				pageSize
			};
		},
		{
			query: type({
				accountId: 'string > 0',
				'after?': 'string > 0 | undefined | null',
				'clientId?': 'string > 0',
				'pageSize?': '0 < number <= 100 | undefined'
			})
		}
	)
	.ws('/api/v1/ws', {
		body: type({
			accountId: 'string',
			clientId: 'string',
			data: 'string',
			signature: 'string',
			type: "'new_events'"
		}),
		async message(ws, body) {
			switch (body.type) {
				case 'new_events': {
					const { accountId, clientId, data, signature } = body;
					const verified = verifyData(data, signature, accountId);
					if (!verified) return;

					const clock = await getLocalClock();
					const syncedAt = clock.increment().toString();
					const timestamp = clock.toString();
					ws.publish(`new_events_${accountId}`, {
						events: [{ data, syncedAt }],
						timestamp,
						type: 'new_events'
					});
					await db.transaction(async (tx) => {
						await receiveMessage({ accountId, clientId, data, syncedAt }, tx);
						await setLocalClock(clock, tx);
					});
					ws.send({ timestamp, type: 'got_events' });
					break;
				}
			}
		},
		async open(ws) {
			const { accountId, clientId, lastSyncedAt } = ws.data.query;
			ws.subscribe(`new_events_${accountId}`);
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
			ws.send({
				events,
				timestamp: (await getMetadata('clock'))!,
				type: 'new_events'
			});
		},
		query: type({
			accountId: 'string',
			clientId: 'string',
			'lastSyncedAt?': 'string | undefined'
		})
	})
	.listen(process.env.PORT || DEFAULT_PORT);

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port} using database at ${env.DATABASE_CONNECTION_URL}`
);
