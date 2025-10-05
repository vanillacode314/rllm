import cors from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { cron } from '@elysiajs/cron';
import { lte, asc, and, eq, gte, ne, gt } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { ethers } from 'ethers';

import { db } from './db/client';
import { receiveMessage } from './db/messages';
import * as schema from './db/schema';
import { getMetadata } from './utils/db';
import { type } from 'arktype';
import crypto from 'crypto';

const CHALLENGES = new Map<string, { nonce: string; expires: number }>();
const TOKENS = new Map<string, { accountId: string; expires: number }>();

const auth = new Elysia({ name: 'auth' }).macro({
	auth: {
		async resolve({ request, status }) {
			const token = request.headers.get('authorization')?.slice(7);
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
			const expires = Date.now() + 1000 * 60 * 2;
			CHALLENGES.set(query.accountId, { nonce, expires });
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
			TOKENS.set(token, { accountId, expires: Date.now() + 1000 * 60 * 5 });
			return { token };
		},
		{
			response: {
				200: type({
					token: 'string'
				}),
				401: type({})
			},
			body: type({
				accountId: 'string',
				nonce: 'string',
				signature: 'string'
			})
		}
	)
	.post(
		'/api/v1/messages',
		async ({ status, token, body }) => {
			if (token.accountId !== body.accountId) return status(401, 'Unauthorized');
			const { accountId, clientId, signature, data } = body;
			const verified = verifyData(data, signature, token.accountId);
			if (!verified) return status(401, 'Unauthorized');
			const message = await receiveMessage({ accountId, clientId, data });
			if (!message) throw new Error('Failed to receive message');
			return { timestamp: message.syncedAt };
		},
		{
			auth: true,
			response: {
				200: type({ timestamp: 'string' }),
				401: type('"Unauthorized"')
			},
			body: type({
				accountId: 'string',
				clientId: 'string',
				data: 'string',
				signature: 'string'
			})
		}
	)
	.delete(
		'/api/v1/messages',
		async ({ status, token, body }) => {
			if (token.accountId !== body.accountId) return status(401, {});
			const { accountId, clientId, after, before } = body;
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
				'clientId?': 'string',
				'after?': 'string | undefined',
				'before?': 'string | undefined'
			})
		}
	)
	.get(
		'/api/v1/messages',
		async ({ query }) => {
			const { pageSize = 100, after, accountId, clientId } = query;
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
				messages,
				pageSize,
				hasMore,
				nextAfter
			};
		},
		{
			query: type({
				accountId: 'string > 0',
				'clientId?': 'string > 0',
				'after?': 'string > 0 | undefined | null',
				'pageSize?': '0 < number <= 100 | undefined'
			})
		}
	)
	.ws('/api/v1/ws', {
		body: type({
			accountId: 'string',
			clientId: 'string',
			type: "'new_messages'",
			data: 'string',
			signature: 'string'
		}),
		async message(ws, body) {
			switch (body.type) {
				case 'new_messages': {
					const { signature, clientId, accountId, data } = body;
					const verified = verifyData(data, signature, accountId);
					if (!verified) return;
					const addedMessage = await receiveMessage({ accountId, clientId, data });
					const timestamp = await getMetadata('clock');
					ws.send({ timestamp, type: 'got_messages' });
					if (addedMessage === null) return;
					ws.publish(`new_messages-${accountId}`, {
						messages: [{ data: addedMessage.data, syncedAt: addedMessage.syncedAt }],
						timestamp,
						type: 'new_messages'
					});
					break;
				}
			}
		},
		async open(ws) {
			const { accountId, clientId, lastSyncedAt } = ws.data.query;
			ws.subscribe(`new_messages-${accountId}`);
			const messages = await db
				.select({ data: schema.messages.data, syncedAt: schema.messages.syncedAt })
				.from(schema.messages)
				.where(
					and(
						ne(schema.messages.clientId, clientId),
						gt(schema.messages.syncedAt, lastSyncedAt!).if(lastSyncedAt !== undefined),
						eq(schema.messages.accountId, accountId)
					)
				);
			if (messages.length <= 0) return;
			ws.send({
				messages,
				timestamp: (await getMetadata('clock'))!,
				type: 'new_messages'
			});
		},
		query: type({
			accountId: 'string',
			clientId: 'string',
			'lastSyncedAt?': 'string | undefined'
		})
	})
	.listen(process.env.PORT || 3000);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
