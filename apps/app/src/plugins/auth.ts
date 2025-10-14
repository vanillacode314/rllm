import { cron } from '@elysiajs/cron';
import { type } from 'arktype';
import crypto from 'crypto';
import { Elysia } from 'elysia';

import { verifyData } from '~/utils/auth';

const CHALLENGES = new Map<string, { expires: number; nonce: string }>();
const TOKENS = new Map<string, { accountId: string; expires: number }>();

const CHALLENGE_EXPIRY_MS = 1000 * 60 * 2;
const TOKEN_EXPIRY_MS = 1000 * 60 * 5;
const AUTH_HEADER_PREFIX_LENGTH = 7;

export const authPlugin = new Elysia({ name: 'auth', prefix: '/auth' })
	.macro({
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
	})
	.get(
		'requestChallenge',
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
		'verifyChallenge',
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
	);
