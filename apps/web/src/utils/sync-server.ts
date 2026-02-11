import { fromBinary } from '@bufbuild/protobuf';
import { ethers } from 'ethers';
import { EventSchema, SyncServerGetEventsResponseSchema } from 'proto/event_pb';
import { AsyncResult } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';
import wretch from 'wretch';
import { queryStringAddon } from 'wretch/addons';
import { z } from 'zod/mini';

import type { TValidEvent } from '~/queries/mutations';

import { account } from '~/signals/account';
import { decrypt } from '~/workers/encryption';

import { env } from './env';

const syncServerApi = wretch(env.VITE_SYNC_SERVER_BASE_URL).addon(queryStringAddon);

const getAuthToken = () =>
  tryBlock(
    async function* () {
      const $account = account();
      if (!$account) throw new Error('No Account');

      const challenge = await syncServerApi
        .query({ accountId: $account.id })
        .get('/api/v1/auth/requestChallenge')
        .text();

      const { nonce } = yield* safeParseJson(challenge, {
        validate: z.object({ nonce: z.string() }).parse
      });

      const wallet = new ethers.Wallet($account.privateKey);
      const signature = await wallet.signMessage(nonce);

      const response = await syncServerApi
        .post(
          {
            accountId: $account.id,
            nonce,
            signature
          },
          '/api/v1/auth/verifyChallenge'
        )
        .text();

      const { token } = yield* safeParseJson(response, {
        validate: z.object({ token: z.string() }).parse
      });

      return AsyncResult.Ok(token);
    },
    (e) => new Error('Failed to get auth token', { cause: e })
  );

const createAuthenticatedSyncServerFetcher = () =>
  tryBlock(
    async function* () {
      const token = yield* getAuthToken();
      return AsyncResult.Ok(syncServerApi.auth(`Bearer ${token}`));
    },
    (e) =>
      new Error('Failed to create authenticated sync server fetcher', {
        cause: e
      })
  );

const getMessages = (
  accountId: string,
  aesKey: JsonWebKey,
  config: { after?: null | string; clientId?: string } = {}
) =>
  tryBlock(
    async function* () {
      const blob = await syncServerApi
        .query({
          accountId,
          after: config.after ?? undefined,
          clientId: config.clientId
        })
        .get('/api/v1/messages')
        .blob();
      const data = yield* AsyncResult.from(
        async () =>
          fromBinary(SyncServerGetEventsResponseSchema, new Uint8Array(await blob.arrayBuffer())),
        (error) => new Error('Failed to decode protobuf', { cause: error })
      );

      const actualAesKey = await window.crypto.subtle.importKey(
        'jwk',
        aesKey,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );

      return AsyncResult.Ok(
        Object.assign(data, { messages: await parseEventsFromServer(data, actualAesKey) })
      );
    },
    (e) => new Error('Failed to get paginated messages', { cause: e })
  );

export async function parseEventsFromServer(data: unknown, aesKey: CryptoKey) {
  const events = [] as Array<TValidEvent & { syncedAt: string }>;
  for (const event of data.events) {
    const decryptedEvent = await decrypt(event.data, aesKey);
    const deserialzedEvent = fromBinary(EventSchema, decryptedEvent);
    const type = deserialzedEvent.data.eventType.case;
    const data = deserialzedEvent.data.eventType.value;
    delete data['$typeName'];
    const timestamp = deserialzedEvent.timestamp;
    const version = deserialzedEvent.version;
    events.push({ type, data, timestamp, version, syncedAt: event.syncedAt });
  }
  return events;
}

const getServerId = () =>
  AsyncResult.from(
    () => syncServerApi.get('/api/v1/id').text(),
    (e) => new Error('Failed to get server id', { cause: e })
  );

export {
  createAuthenticatedSyncServerFetcher,
  getAuthToken,
  getMessages,
  getServerId,
  syncServerApi
};
