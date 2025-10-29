import { type } from 'arktype';
import { ethers } from 'ethers';
import { type $Fetch, ofetch } from 'ofetch';
import { AsyncResult } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';
import { releaseProxy } from 'vite-plugin-comlink/symbol';

import * as schema from '~/db/schema';
import { account } from '~/signals/account';
import { makeNewEncryptionWorker } from '~/workers/encryption';

import { env } from './env';

const fetcher = ofetch.create({
	baseURL: env.VITE_SYNC_SERVER_BASE_URL
});

const createAuthenticatedSyncServerFetcher = () =>
	tryBlock<$Fetch, Error>(
		async function* () {
			if (!env.VITE_SYNC_SERVER_BASE_URL) throw new Error('No Sync Server');
			const $account = account();
			if (!$account) throw new Error('No Account');

			const challenge = await fetcher(
				env.VITE_SYNC_SERVER_BASE_URL + '/api/v1/auth/requestChallenge',
				{
					method: 'GET',
					query: {
						accountId: $account.id
					},
					responseType: 'text'
				}
			);

			const { nonce } = yield* safeParseJson(challenge, {
				validate: type({
					nonce: 'string'
				}).assert
			});

			const wallet = new ethers.Wallet($account.privateKey);
			const signature = await wallet.signMessage(nonce);

			const response = await ofetch(
				env.VITE_SYNC_SERVER_BASE_URL + '/api/v1/auth/verifyChallenge',
				{
					method: 'POST',
					body: {
						accountId: $account.id,
						nonce,
						signature
					},
					responseType: 'text'
				}
			);

			const { token } = yield* safeParseJson(response, {
				validate: type({
					token: 'string'
				}).assert
			});

			return AsyncResult.Ok(
				ofetch.create({
					baseURL: env.VITE_SYNC_SERVER_BASE_URL,
					headers: {
						Authorization: `Bearer ${token}`
					}
				})
			);
		},
		(e) =>
			new Error('Failed to create authenticated sync server fetcher', {
				cause: e
			})
	);

const messagesResponseSchema = type({
	nextAfter: 'string | null',
	hasMore: 'boolean',
	pageSize: 'number',
	messages: [{ data: 'string', syncedAt: 'string' }, '[]']
});

const getMessages = (
	accountId: string,
	aesKey: JsonWebKey,
	config: { after?: null | string; clientId?: string } = {}
) =>
	tryBlock(
		async function* () {
			const json = await fetcher('/api/v1/messages', {
				responseType: 'text',
				query: {
					accountId,
					after: config.after ?? undefined,
					clientId: config.clientId
				}
			});
			const data = yield* safeParseJson(json, {
				validate: messagesResponseSchema.assert
			});

			const actualAesKey = await window.crypto.subtle.importKey(
				'jwk',
				aesKey,
				{ name: 'AES-GCM' },
				true,
				['encrypt', 'decrypt']
			);

			const controller = new AbortController();
			const decryptedMessages = await Promise.all(
				data.messages
					.map(async ({ data, syncedAt }) => {
						const encryptionWorker = makeNewEncryptionWorker();
						controller.signal.addEventListener('abort', () => encryptionWorker.abort());
						data = await encryptionWorker.decrypt(data, actualAesKey);
						encryptionWorker[releaseProxy]();
						const messages = schema.messagesSchema.array().assert(JSON.parse(data));
						return messages.map((message) => Object.assign(message, { syncedAt }));
					})
					.map((promise) => promise.catch((e) => (controller.abort(), Promise.reject(e))))
			);
			return AsyncResult.Ok(Object.assign(data, { messages: decryptedMessages.flat() }));
		},
		(e) => new Error('Failed to get paginated messages', { cause: e })
	);

export { createAuthenticatedSyncServerFetcher, getMessages };
