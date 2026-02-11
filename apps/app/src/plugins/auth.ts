import { cron } from '@elysiajs/cron';
import crypto from 'crypto';
import { Elysia, t } from 'elysia';

import { verifyData } from '~/utils/auth';

const CHALLENGES = new Map<string, { expiresAt: number; nonce: string }>();
const TOKENS = new Map<string, { accountId: string; expiresAt: number }>();

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
				if (tokenData.expiresAt < Date.now()) {
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
			const expiresAt = Date.now() + CHALLENGE_EXPIRY_MS;
			CHALLENGES.set(query.accountId, { expiresAt, nonce });
			return { nonce };
		},
		{ query: t.Object({ accountId: t.String() }) }
	)
	.post(
		'verifyChallenge',
		async ({ body, status }) => {
			const { accountId, nonce, signature } = body;

			const challenge = CHALLENGES.get(accountId);
			if (!challenge) return status(401, 'Unauthorized');
			CHALLENGES.delete(accountId);

			if (challenge.nonce !== nonce) return status(401, 'Unauthorized');
			if (challenge.expiresAt < Date.now()) return status(401, 'Unauthorized');

			const verified = verifyData(nonce, signature, accountId);
			if (!verified) return status(401, 'Unauthorized');

			const token = crypto.randomBytes(32).toString('hex');
			TOKENS.set(token, { accountId, expiresAt: Date.now() + TOKEN_EXPIRY_MS });

			return { token };
		},
		{
			body: t.Object({
				accountId: t.String(),
				nonce: t.String(),
				signature: t.String()
			}),
			response: {
				200: t.Object({ token: t.String() }),
				401: t.Literal('Unauthorized')
			}
		}
	)
	.use(
		cron({
			name: 'cleanup',
			pattern: '0 * * * * *',
			run() {
				CHALLENGES.forEach((value, key) => {
					if (value.expiresAt < Date.now()) {
						CHALLENGES.delete(key);
					}
				});
				TOKENS.forEach((value, key) => {
					if (value.expiresAt < Date.now()) {
						TOKENS.delete(key);
					}
				});
			}
		})
	);
