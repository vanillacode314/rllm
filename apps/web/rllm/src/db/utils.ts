import { sql } from 'event-logger';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import { CURRENT_MODEL_ID } from '~/constants/chat-settings';
import { lastOpenedPageSchema, STARTUP_PAGE_VALUES, type TStartupPage } from '~/constants/settings';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { parseProxyUrls } from '~/lib/proxy';
import type { TValidEvent } from '~/queries/mutations';
import { once } from '~/utils/functions';

import {
  chatsSchema,
  type TChat,
  type TChatPreset,
  type TDocument,
  type TMCP,
  type TProvider,
  type TUserMetadata
} from './app-schema';
import type { LoggerInstance } from './client.types';

export type TMinimalChat = Pick<TChat, 'finished' | 'id' | 'tags' | 'title'>;

export type TPagedMinimalChat = TMinimalChat & { score: number };

type TAllData = {
  chatPresets: TChatPreset[];
  chats: TChat[];
  mcps: TMCP[];
  providers: TProvider[];
  userMetadata: TUserMetadata[];
};

type TEventData<TType extends TValidEvent['type']> = Extract<TValidEvent, { type: TType }>['data'];

type TLastOpenedPage = z.infer<typeof lastOpenedPageSchema>;

type TWriteOptions = { dontLog?: boolean };

export function createDbApi(logger: LoggerInstance) {
  const getMetadataValue = async (id: string): Promise<null | string> => {
    const rows = await logger.db.query<{ value: string }>(
      logger.sql`SELECT value FROM userMetadata WHERE id = ${id}`
    );
    return rows[0]?.value ?? null;
  };
  const setMetadataValue = (id: string, value: string, opts?: TWriteOptions) =>
    logger.dispatch({ data: { id, value }, type: 'setUserMetadata', ...opts });

  const chatPresets = {
    all: () =>
      logger.db
        .query<TChatPreset>(
          logger.sql`SELECT "createdAt", "id", "name", "settings" FROM chatPresets ORDER BY "createdAt" DESC`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['settings'] });
          return rows;
        }),
    create: (data: Omit<TEventData<'createPreset'>, 'createdAt'>, opts?: TWriteOptions) =>
      logger.dispatch({
        data: { ...data, createdAt: new Date().toISOString() },
        type: 'createPreset',
        ...opts
      }),
    createMany: (data: Omit<TEventData<'createPreset'>, 'createdAt'>[], opts?: TWriteOptions) => {
      const createdAt = new Date().toISOString();
      return logger.dispatch(
        ...data.map((entry) => ({
          data: { ...entry, createdAt },
          type: 'createPreset' as const,
          ...opts
        }))
      );
    },
    delete: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'deletePreset', ...opts }),
    get: (id: string) =>
      logger.db
        .query<TChatPreset>(logger.sql`SELECT * FROM chatPresets WHERE id = ${id}`)
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['settings'] });
          return rows.length > 0 ? rows[0] : null;
        }),
    update: (id: string, data: Omit<TEventData<'updatePreset'>, 'id'>, opts?: TWriteOptions) =>
      logger.dispatch({ data: { ...data, id }, type: 'updatePreset', ...opts })
  };

  const chats = {
    all: () =>
      logger.db
        .query<TChat>(
          logger.sql`SELECT "accessCount", "createdAt", "finished", "id", "lastAccessedAt", "messages", "settings", "tags", "title" FROM chats ORDER BY "createdAt" DESC`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, {
            booleanKeys: ['finished'],
            jsonKeys: ['messages', 'settings', 'tags']
          });
          return rows;
        }),
    count: () =>
      logger.db
        .query<{ count: number }>(logger.sql`SELECT count(*) as count FROM chats`)
        .then((rows) => rows[0]?.count ?? 0),
    countFiltered: (query?: string, tags?: string[]) => {
      const conditions: string[] = [];
      const params: string[] = [];

      if (query && query.trim().length > 0) {
        conditions.push(`LOWER("title") LIKE ?`);
        params.push(`%${query.toLowerCase()}%`);
      }

      if (tags && tags.filter((tag) => tag.trim().length > 0).length > 0) {
        const filteredTags = tags
          .filter((tag) => tag.trim().length > 0)
          .map((tag) => tag.toLowerCase());
        conditions.push(
          `EXISTS (SELECT 1 FROM json_each("chats"."tags") WHERE LOWER(json_each.value) IN (${filteredTags.map(() => '?').join(', ')}))`
        );
        params.push(...filteredTags);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      return logger.db
        .query<{ count: number }>({
          params,
          sql: `SELECT count(*) as count FROM chats ${whereClause}`
        })
        .then((rows) => rows[0]?.count ?? 0);
    },
    create: (data: Omit<TEventData<'createChat'>, 'createdAt'>, opts?: TWriteOptions) =>
      logger.dispatch({
        data: { ...data, createdAt: new Date().toISOString() },
        type: 'createChat',
        ...opts
      }),
    createMany: (data: Omit<TEventData<'createChat'>, 'createdAt'>[], opts?: TWriteOptions) => {
      const createdAt = new Date().toISOString();
      return logger.dispatch(
        ...data.map((entry) => ({
          data: { ...entry, createdAt },
          type: 'createChat' as const,
          ...opts
        }))
      );
    },
    delete: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'deleteChat', ...opts }),
    get: (id: string) =>
      logger.db.query<TChat>(logger.sql`SELECT * FROM chats WHERE id = ${id}`).then((rows) => {
        parseDbRowsInPlace(rows, {
          booleanKeys: ['finished'],
          jsonKeys: ['messages', 'settings', 'tags']
        });
        return rows[0] ?? null;
      }),
    incrementAccessCount: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'incrementChatAccessCount', ...opts }),
    minimal: () =>
      logger.db
        .query<TMinimalChat>(
          logger.sql`SELECT "finished", "id", "tags", "title" FROM chats ORDER BY "createdAt" DESC`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, { booleanKeys: ['finished'], jsonKeys: ['tags'] });
          return rows;
        }),
    pagedMinimal: (limit: number, offset: number, query?: string, tags?: string[]) => {
      const conditions: string[] = [];
      const params: string[] = [];

      if (query && query.trim().length > 0) {
        conditions.push(`LOWER("title") LIKE ?`);
        params.push(`%${query.toLowerCase()}%`);
      }

      if (tags && tags.filter((tag) => tag.trim().length > 0).length > 0) {
        const filteredTags = tags
          .filter((tag) => tag.trim().length > 0)
          .map((tag) => tag.toLowerCase());
        conditions.push(
          `EXISTS (SELECT 1 FROM json_each("chats"."tags") WHERE LOWER(json_each.value) IN (${filteredTags.map(() => '?').join(', ')}))`
        );
        params.push(...filteredTags);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      return logger.db
        .query<TPagedMinimalChat>({
          params: [...params, limit, offset],
          sql: `SELECT "finished", "id", "accessCount" * MAX(0, 1 - (strftime('%s','now') - ("lastAccessedAt" / 1000.0)) / (86400.0 * 7)) as "score", "tags", "title" FROM chats ${whereClause} ORDER BY "score" DESC, "lastAccessedAt" DESC, "createdAt" DESC, "score" IS NULL LIMIT ? OFFSET ?`
        })
        .then((rows) => {
          parseDbRowsInPlace(rows, { booleanKeys: ['finished'], jsonKeys: ['tags'] });
          return rows;
        });
    },
    recent: (limit: number = 5) =>
      logger.db.query<Pick<TChat, 'id' | 'title'>>(
        logger.sql`SELECT "id", "title" FROM chats ORDER BY "lastAccessedAt" DESC LIMIT ${limit}`
      ),
    tags: () =>
      logger.db
        .query<{ value: string }>(
          logger.sql`SELECT DISTINCT e.value FROM "chats" CROSS JOIN json_each("chats"."tags") AS e`
        )
        .then((rows) => rows.map((row) => row.value)),
    update: (id: string, data: Omit<TEventData<'updateChat'>, 'id'>, opts?: TWriteOptions) =>
      logger.dispatch({ data: { ...data, id }, type: 'updateChat', ...opts })
  };

  const documents = {
    all: () =>
      logger.db.query<TDocument>(
        logger.sql`SELECT "id", "name" FROM documents ORDER BY "createdAt" DESC`
      ),
    create: (data: Omit<TEventData<'createDocument'>, 'createdAt'>, opts?: TWriteOptions) =>
      logger.dispatch({
        data: { ...data, createdAt: new Date().toISOString() },
        type: 'createDocument',
        ...opts
      }),
    delete: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'deleteDocument', ...opts }),
    get: (id: string) =>
      logger.db
        .query<TDocument>(logger.sql`SELECT * FROM documents WHERE id = ${id}`)
        .then((rows) => rows[0] ?? null)
  };

  const events = {
    count: () =>
      logger.db
        .query<{ count: number }>(logger.sql`SELECT count(*) as count FROM events`)
        .then((rows) => rows[0]?.count ?? 0),
    paginated: (page: number, pageSize: number) =>
      logger.db.query<{ data: string; timestamp: string; type: string; version: string }>(
        logger.sql`SELECT "data", "timestamp", "type", "version" FROM events ORDER BY "timestamp" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
      )
  };

  const mcps = {
    all: () =>
      logger.db.query<Pick<TMCP, 'createdAt' | 'id' | 'name' | 'url'>>(
        logger.sql`SELECT "createdAt", "id", "name", "url" FROM mcps ORDER BY "name"`
      ),
    create: (data: Omit<TEventData<'createMcp'>, 'createdAt'>, opts?: TWriteOptions) =>
      logger.dispatch({
        data: { ...data, createdAt: new Date().toISOString() },
        type: 'createMcp',
        ...opts
      }),
    createMany: (data: Omit<TEventData<'createMcp'>, 'createdAt'>[], opts?: TWriteOptions) => {
      const createdAt = new Date().toISOString();
      return logger.dispatch(
        ...data.map((entry) => ({
          data: { ...entry, createdAt },
          type: 'createMcp' as const,
          ...opts
        }))
      );
    },
    delete: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'deleteMcp', ...opts }),
    get: (id: string) =>
      logger.db
        .query<TMCP>(logger.sql`SELECT * FROM mcps WHERE id = ${id}`)
        .then((rows) => rows[0] ?? null),
    recent: () =>
      logger.db.query<Pick<TMCP, 'createdAt' | 'id' | 'name' | 'url'>>(
        logger.sql`SELECT "createdAt", "id", "name", "url" FROM mcps ORDER BY "createdAt" DESC`
      ),
    update: (id: string, data: Omit<TEventData<'updateMcp'>, 'id'>, opts?: TWriteOptions) =>
      logger.dispatch({ data: { ...data, id }, type: 'updateMcp', ...opts })
  };

  const providers = {
    all: () =>
      logger.db
        .query<TProvider>(
          logger.sql`SELECT "baseUrl", "createdAt", "defaultModelIds", "id", "name", "token", "type" FROM providers`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['defaultModelIds'] });
          return rows;
        }),
    count: () =>
      logger.db
        .query<{ value: number }>(logger.sql`SELECT count(*) as value FROM providers`)
        .then((rows) => rows[0]?.value ?? 0),
    create: (data: Omit<TEventData<'createProvider'>, 'createdAt'>, opts?: TWriteOptions) =>
      logger.dispatch({
        data: { ...data, createdAt: new Date().toISOString() },
        type: 'createProvider',
        ...opts
      }),
    createMany: (data: Omit<TEventData<'createProvider'>, 'createdAt'>[], opts?: TWriteOptions) => {
      const createdAt = new Date().toISOString();
      return logger.dispatch(
        ...data.map((entry) => ({
          data: { ...entry, createdAt },
          type: 'createProvider' as const,
          ...opts
        }))
      );
    },
    delete: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'deleteProvider', ...opts }),
    first: () =>
      logger.db
        .query<TProvider>(logger.sql`SELECT * FROM providers ORDER BY "createdAt" ASC LIMIT 1`)
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['defaultModelIds'] });
          return rows[0] ?? null;
        }),
    get: async (id: string): Promise<null | TProvider> => {
      const rows = await logger.db.query<TProvider>(
        logger.sql`SELECT * FROM providers WHERE id = ${id}`
      );
      parseDbRowsInPlace(rows, { jsonKeys: ['defaultModelIds'] });
      return rows[0] ?? null;
    },
    update: (id: string, data: Omit<TEventData<'updateProvider'>, 'id'>, opts?: TWriteOptions) =>
      logger.dispatch({ data: { ...data, id }, type: 'updateProvider', ...opts })
  };

  const userMetadata = {
    corsProxyUrls: async (): Promise<string[]> =>
      parseProxyUrls(await getMetadataValue(USER_METADATA_KEYS.CORS_PROXY_URL)),
    defaultChatSettingsPresetId: () =>
      getMetadataValue(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET),
    delete: (id: string, opts?: TWriteOptions) =>
      logger.dispatch({ data: { id }, type: 'deleteUserMetadata', ...opts }),
    deleteDefaultChatSettingsPresetId: () =>
      logger.dispatch({
        data: { id: USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET },
        type: 'deleteUserMetadata'
      }),
    deleteScratchpadChat: () =>
      logger.dispatch({
        data: { id: USER_METADATA_KEYS.SCRATCHPAD_CHAT },
        dontLog: true,
        type: 'deleteUserMetadata'
      }),
    get: getMetadataValue,
    hideReasoningDuringGeneration: async (): Promise<boolean> =>
      (await getMetadataValue(USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION)) !== 'false',
    lastOpenedPage: async (): Promise<null | TLastOpenedPage> => {
      return Option.from(await getMetadataValue(USER_METADATA_KEYS.LAST_OPENED_PAGE))
        .andThen((value) => safeParseJson(value, { validate: lastOpenedPageSchema.parse }).ok())
        .toNull();
    },
    scratchpadChat: async (): Promise<null | TChat> => {
      return Option.from(await getMetadataValue(USER_METADATA_KEYS.SCRATCHPAD_CHAT))
        .andThen((value) => safeParseJson(value, { validate: chatsSchema.parse }).ok())
        .toNull();
    },
    selectedModelId: () => getMetadataValue(USER_METADATA_KEYS.SELECTED_MODEL_ID),
    setCorsProxyUrls: (urls: string[]) =>
      setMetadataValue(USER_METADATA_KEYS.CORS_PROXY_URL, urls.join('\n')),
    setDefaultChatSettingsPresetId: (id: string) =>
      setMetadataValue(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET, id),
    setHideReasoningDuringGeneration: (value: boolean) =>
      setMetadataValue(USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION, String(value)),
    setLastOpenedPage: (page: TLastOpenedPage) =>
      logger.dispatch({
        data: { id: USER_METADATA_KEYS.LAST_OPENED_PAGE, value: JSON.stringify(page) },
        dontLog: true,
        type: 'setUserMetadata'
      }),
    setScratchpadChat: (chat: Record<string, unknown>) =>
      logger.dispatch({
        data: { id: USER_METADATA_KEYS.SCRATCHPAD_CHAT, value: JSON.stringify(chat) },
        dontLog: true,
        type: 'setUserMetadata'
      }),
    setSelectedModelId: (id: string) => setMetadataValue(USER_METADATA_KEYS.SELECTED_MODEL_ID, id),
    setStartupPage: (page: TStartupPage) => setMetadataValue(USER_METADATA_KEYS.STARTUP_PAGE, page),
    setTitleGeneration: async (providerId: string, opts?: TWriteOptions) => {
      const provider = await providers.get(providerId);
      const modelId = provider?.defaultModelIds[0] ?? CURRENT_MODEL_ID;
      await logger.dispatch(
        {
          data: { id: USER_METADATA_KEYS.TITLE_GENERATION_PROVIDER_ID, value: providerId },
          type: 'setUserMetadata',
          ...opts
        },
        {
          data: { id: USER_METADATA_KEYS.TITLE_GENERATION_MODEL_ID, value: modelId },
          type: 'setUserMetadata',
          ...opts
        }
      );
    },
    setTitleGenerationModelId: (id: string) =>
      setMetadataValue(USER_METADATA_KEYS.TITLE_GENERATION_MODEL_ID, id),
    setTitleGenerationProviderId: (id: string) =>
      setMetadataValue(USER_METADATA_KEYS.TITLE_GENERATION_PROVIDER_ID, id),
    setUserDisplayName: (name: string) =>
      setMetadataValue(USER_METADATA_KEYS.USER_DISPLAY_NAME, name),
    setWebSearchMcpId: (id: string) => setMetadataValue(USER_METADATA_KEYS.WEB_SEARCH_MCP_ID, id),
    startupPage: async (): Promise<null | TStartupPage> => {
      const value = await getMetadataValue(USER_METADATA_KEYS.STARTUP_PAGE);
      if (value !== null && STARTUP_PAGE_VALUES.includes(value)) return value as TStartupPage;
      return null;
    },
    titleGenerationModelId: () => getMetadataValue(USER_METADATA_KEYS.TITLE_GENERATION_MODEL_ID),
    titleGenerationProviderId: () =>
      getMetadataValue(USER_METADATA_KEYS.TITLE_GENERATION_PROVIDER_ID),
    upsert: setMetadataValue,
    upsertMany: (data: TEventData<'setUserMetadata'>[], opts?: TWriteOptions) =>
      logger.dispatch(
        ...data.map((entry) => ({ data: entry, type: 'setUserMetadata' as const, ...opts }))
      ),
    userDisplayName: () => getMetadataValue(USER_METADATA_KEYS.USER_DISPLAY_NAME),
    webSearchMcpId: () => getMetadataValue(USER_METADATA_KEYS.WEB_SEARCH_MCP_ID)
  };

  return {
    chatPresets,
    chats,
    // NOTE: we assume clientId never changes once set for a device so we don't need to rerun more than once
    id: once(() => {
      return logger.getId();
    }),
    createChatFromScratchpad: (
      data: Omit<TEventData<'createChat'>, 'createdAt'>,
      opts?: TWriteOptions
    ) =>
      logger.dispatch(
        { data: { ...data, createdAt: new Date().toISOString() }, type: 'createChat', ...opts },
        {
          data: { id: USER_METADATA_KEYS.SCRATCHPAD_CHAT },
          type: 'deleteUserMetadata',
          ...opts
        }
      ),
    documents,
    events,
    exportData: async (): Promise<TAllData> => {
      const [
        exportedChats,
        exportedMcps,
        exportedProviders,
        exportedUserMetadata,
        exportedPresets
      ] = await Promise.all([
        parseDbRowsInPlace(
          logger.db.query<TChat>(logger.sql`SELECT * FROM "chats" ORDER BY "chats"."createdAt"`),
          { booleanKeys: ['finished'], jsonKeys: ['settings', 'messages', 'tags'] }
        ),
        parseDbRowsInPlace(
          logger.db.query<TMCP>(logger.sql`SELECT * FROM "mcps" ORDER BY "mcps"."createdAt"`)
        ),
        parseDbRowsInPlace(
          logger.db.query<TProvider>(
            logger.sql`SELECT * FROM "providers" ORDER BY "providers"."createdAt"`
          ),
          { jsonKeys: ['defaultModelIds'] }
        ),
        logger.db.query<TUserMetadata>(
          logger.sql`SELECT * FROM "userMetadata" ORDER BY "userMetadata"."id"`
        ),
        parseDbRowsInPlace(
          logger.db.query<TChatPreset>(
            logger.sql`SELECT * FROM "chatPresets" ORDER BY "chatPresets"."createdAt"`
          ),
          { jsonKeys: ['settings'] }
        )
      ]);
      return {
        chatPresets: exportedPresets,
        chats: exportedChats,
        mcps: exportedMcps,
        providers: exportedProviders,
        userMetadata: exportedUserMetadata
      };
    },
    importData: (data: TAllData, opts?: TWriteOptions) =>
      logger.dispatch(
        ...data.providers.map((entry) => ({
          data: entry,
          type: 'createProvider' as const,
          ...opts
        })),
        ...data.mcps.map((entry) => ({ data: entry, type: 'createMcp' as const, ...opts })),
        ...data.chats.map((entry) => ({ data: entry, type: 'createChat' as const, ...opts })),
        ...data.userMetadata.map((entry) => ({
          data: entry,
          type: 'setUserMetadata' as const,
          ...opts
        })),
        ...data.chatPresets.map((entry) => ({
          data: entry,
          type: 'createPreset' as const,
          ...opts
        }))
      ),
    mcps,
    providers,
    userMetadata
  };
}

export function createLoggerProxy(getLogger: () => Promise<LoggerInstance>): LoggerInstance {
  return {
    clearMetadata: async (key, tx) => (await getLogger()).clearMetadata(key, tx),
    get db() {
      return {
        batch: (statements: Parameters<LoggerInstance['db']['batch']>[0]) =>
          getLogger().then((instance) => instance.db.batch(statements)),
        query: (statement: Parameters<LoggerInstance['db']['query']>[0]) =>
          getLogger().then((instance) => instance.db.query(statement)),
        transaction: <T>(
          fn: (tx: Parameters<Parameters<LoggerInstance['db']['transaction']>[0]>[0]) => Promise<T>
        ) => getLogger().then((instance) => instance.db.transaction(fn))
      } as LoggerInstance['db'];
    },
    dispatch: async (...events) => (await getLogger()).dispatch(...events),
    getClientId: async () => (await getLogger()).getClientId(),
    getClock: async () => (await getLogger()).getClock(),
    getMerkleTree: async () => (await getLogger()).getMerkleTree(),
    getMetadata: async (key) => (await getLogger()).getMetadata(key),
    getVersion: async () => (await getLogger()).getVersion(),
    invalidateSchema: async () => (await getLogger()).invalidateSchema(),
    on: (type, handler, opts) => {
      let unsubscribe: (() => void) | null = null;
      let isCancelled = false;

      void getLogger().then((instance) => {
        if (!isCancelled) {
          unsubscribe = instance.on(type, handler, opts);
        }
        return undefined;
      });

      return () => {
        isCancelled = true;
        if (unsubscribe) unsubscribe();
      };
    },
    receive: async (events, tx) => (await getLogger()).receive(events, tx),

    setMetadata: async (key, value) => (await getLogger()).setMetadata(key, value),

    setVersion: async (version, tx) => (await getLogger()).setVersion(version, tx),

    get sql() {
      return sql;
    }
  };
}

export async function parseDbRowsInPlace<TRow extends Record<string, unknown>>(
  rowsPromise: Promise<TRow[]> | TRow[],
  opts: Partial<{
    booleanKeys: (keyof TRow)[];
    jsonKeys: (keyof TRow)[];
  }> = {}
): Promise<TRow[]> {
  const rows = await rowsPromise;
  const { booleanKeys = [], jsonKeys = [] } = opts;
  for (const row of rows) {
    for (const key of jsonKeys) {
      if (key in row) {
        row[key] = JSON.parse(row[key] as string);
      }
    }
    for (const key of booleanKeys) {
      if (key in row) {
        row[key] = Boolean(row[key]) as never;
      }
    }
  }
  return rows;
}
