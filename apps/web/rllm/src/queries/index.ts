import { infiniteQueryOptions, queryOptions } from '@tanstack/solid-query';

import type { TChat, TChatPreset, TDocument, TMCP, TProvider } from '~/db/app-schema';

import { logger } from '~/db/client';
import { MCPClient } from '~/lib/mcp/client';
import { QueryCacheManager } from '~/lib/query-cache';
import { parseDbRowsInPlace } from '~/utils/db';

const FIVE_MINUTES_IN_MILLISECONDS = 5 * 60 * 1000;

const userMetadata = {
  fetchers: {
    byId: async (id: string): Promise<null | string> => {
      const rows = await logger.db.query<{ value: string }>(
        logger.sql`SELECT value FROM userMetadata WHERE id = ${id}`
      );
      return rows[0]?.value ?? null;
    },
    staleTime: Infinity
  },
  queries: {
    base: () => ['db', 'userMetadata'],
    byId: (id: string) =>
      queryOptions({
        queryFn: () => userMetadata.fetchers.byId(id),
        queryKey: [...userMetadata.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

const providers = {
  fetchers: {
    byId: async (id: string): Promise<null | TProvider> => {
      const rows = await logger.db.query<TProvider>(
        logger.sql`SELECT * FROM providers WHERE id = ${id}`
      );
      parseDbRowsInPlace(rows, { jsonKeys: ['defaultModelIds'] });
      return rows[0] ?? null;
    },
    countProviders: () =>
      logger.db
        .query<{ value: number }>(logger.sql`SELECT count(*) as value FROM providers`)
        .then((rows) => rows[0]?.value ?? 0),
    getAllProviders: () =>
      logger.db
        .query<TProvider>(
          logger.sql`SELECT "baseUrl", "createdAt", "defaultModelIds", "id", "name", "token", "type" FROM providers`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['defaultModelIds'] });
          return rows;
        })
  },
  queries: {
    all: () => {
      return Object.assign(
        queryOptions({
          queryFn: () => providers.fetchers.getAllProviders(),
          queryKey: [...providers.queries.base(), 'all'],
          staleTime: Infinity
        }),
        {
          _ctx: {
            count: queryOptions({
              queryFn: () => providers.fetchers.countProviders(),
              queryKey: [...providers.queries.base(), 'all', 'count'],
              staleTime: Infinity
            })
          }
        }
      );
    },
    base: () => ['db', 'providers'],
    byId: (id: null | string | undefined) =>
      queryOptions({
        queryFn: () => {
          if (!id) throw new Error(`Invalid id ${id}`);
          return logger.db
            .query<TProvider>(logger.sql`SELECT * FROM providers WHERE id = ${id}`)
            .then((rows) => {
              parseDbRowsInPlace(rows, { jsonKeys: ['defaultModelIds'] });
              return rows[0] ?? null;
            });
        },
        queryKey: [...providers.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

const models = {
  queries: {
    all: () => ['db', 'models', 'all'],
    base: () => ['db', 'models']
  }
};

const chats = {
  fetchers: {
    byId: (id: string) =>
      logger.db.query<TChat>(logger.sql`SELECT * FROM chats WHERE id = ${id}`).then((rows) => {
        parseDbRowsInPlace(rows, {
          booleanKeys: ['finished'],
          jsonKeys: ['messages', 'settings', 'tags']
        });
        return rows[0] ?? null;
      }),
    countChats: () =>
      logger.db
        .query<{ count: number }>(logger.sql`SELECT count(*) as count FROM chats`)
        .then((rows) => rows[0]?.count ?? 0),
    countFilteredChats: (query?: string, tags?: string[]) => {
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
          sql: `SELECT count(*) as count FROM chats ${whereClause}`,
          params
        })
        .then((rows) => rows[0]?.count ?? 0);
    },
    getAllChats: () =>
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
    getChatTags: () =>
      logger.db
        .query<{ value: string }>(
          logger.sql`SELECT DISTINCT e.value FROM "chats" CROSS JOIN json_each("chats"."tags") AS e`
        )
        .then((rows) => rows.map((row) => row.value)),
    getMinimalChats: () =>
      logger.db
        .query<Pick<TChat, 'finished' | 'id' | 'tags' | 'title'>>(
          logger.sql`SELECT "finished", "id", "tags", "title" FROM chats ORDER BY "createdAt" DESC`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, { booleanKeys: ['finished'], jsonKeys: ['tags'] });
          return rows;
        }),
    getPagedMinimalChats: (limit: number, offset: number, query?: string, tags?: string[]) => {
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
        .query<Pick<TChat, 'finished' | 'id' | 'tags' | 'title'> & { score: number }>({
          sql: `SELECT "finished", "id", "accessCount" * MAX(0, 1 - (strftime('%s','now') - ("lastAccessedAt" / 1000.0)) / (86400.0 * 7)) as "score", "tags", "title" FROM chats ${whereClause} ORDER BY "score" DESC, "lastAccessedAt" DESC, "createdAt" DESC, "score" IS NULL LIMIT ? OFFSET ?`,
          params: [...params, limit, offset]
        })
        .then((rows) => {
          parseDbRowsInPlace(rows, { booleanKeys: ['finished'], jsonKeys: ['tags'] });
          return rows;
        });
    },
    recent: (limit: number = 5) =>
      logger.db.query<Pick<TChat, 'id' | 'title'>>(
        logger.sql`SELECT "id", "title" FROM chats ORDER BY "lastAccessedAt" DESC LIMIT ${limit}`
      )
  },
  queries: {
    all: () =>
      Object.assign(
        queryOptions({
          queryFn: () => chats.fetchers.getAllChats(),
          queryKey: [...chats.queries.base(), 'all'],
          staleTime: Infinity
        }),
        {
          _ctx: {
            count: () =>
              queryOptions({
                queryFn: chats.fetchers.countChats,
                queryKey: [...chats.queries.base(), 'all', 'count'],
                staleTime: FIVE_MINUTES_IN_MILLISECONDS
              }),
            filteredCount: ({ query, tags }: { query?: string; tags?: string[] }) =>
              queryOptions({
                queryFn: () => chats.fetchers.countFilteredChats(query, tags),
                queryKey: [...chats.queries.base(), 'all', { query, tags }, 'count'],
                staleTime: FIVE_MINUTES_IN_MILLISECONDS
              }),
            minimal: queryOptions({
              queryFn: () => chats.fetchers.getMinimalChats(),
              queryKey: [...chats.queries.base(), 'all', 'minimal']
            }),
            pagedMinimal: ({
              pageSize = 30,
              query,
              tags
            }: {
              pageSize?: number;
              query?: string;
              tags?: string[];
            } = {}) =>
              infiniteQueryOptions({
                queryFn: ({ pageParam }) =>
                  chats.fetchers.getPagedMinimalChats(pageSize, pageParam, query, tags),
                // oxlint-disable-next-line perfectionist/sort-objects
                getNextPageParam: (lastPage, _allPages, lastPageParam) =>
                  lastPage.length < pageSize ? undefined : lastPageParam + pageSize,
                initialPageParam: 0,
                queryKey: [
                  ...chats.queries.base(),
                  'all',
                  'minimal',
                  'paged',
                  { pageSize, query, tags }
                ]
              }),
            recent: (limit?: number) =>
              queryOptions({
                queryFn: () => chats.fetchers.recent(limit),
                queryKey: [...chats.queries.base(), 'all', 'recent', { limit }],
                staleTime: FIVE_MINUTES_IN_MILLISECONDS
              }),
            tags: queryOptions({
              queryFn: () => chats.fetchers.getChatTags(),
              queryKey: [...chats.queries.base(), 'all', 'tags'],
              staleTime: Infinity
            })
          }
        }
      ),
    base: () => ['db', 'chats'],
    byId: (id: string) =>
      queryOptions({
        queryFn: () => chats.fetchers.byId(id),
        queryKey: [...chats.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

const mcps = {
  fetchers: {
    getAllMcps: () =>
      logger.db.query<Pick<TMCP, 'createdAt' | 'id' | 'name' | 'url'>>(
        logger.sql`SELECT "createdAt", "id", "name", "url" FROM mcps ORDER BY "name"`
      ),
    getClients: (proxy?: null | string | undefined) =>
      mcps.fetchers
        .getAllMcps()
        .then((mcps) =>
          mcps.map((mcp) => new MCPClient(mcp.name, proxy ? proxy.replace('%s', mcp.url) : mcp.url))
        )
  },
  queries: {
    all: () =>
      Object.assign(
        queryOptions({
          queryFn: () =>
            logger.db.query<Pick<TMCP, 'createdAt' | 'id' | 'name' | 'url'>>(
              logger.sql`SELECT "createdAt", "id", "name", "url" FROM mcps ORDER BY "createdAt" DESC`
            ),
          queryKey: [...mcps.queries.base(), 'all'],
          staleTime: Infinity
        }),
        {
          _ctx: {
            clients: (proxy?: null | string | undefined) =>
              queryOptions({
                queryFn: () => mcps.fetchers.getClients(proxy),
                queryKey: [...mcps.queries.base(), 'all', 'clients', { proxy }],
                staleTime: Infinity
              })
          }
        }
      ),
    base: () => ['db', 'mcps'],
    byId: (id: string) =>
      queryOptions({
        queryFn: () =>
          logger.db
            .query<TMCP>(logger.sql`SELECT * FROM mcps WHERE id = ${id}`)
            .then((rows) => rows[0] ?? null),
        queryKey: [...mcps.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

const events = {
  fetchers: {
    countEvents: () =>
      logger.db
        .query<{ count: number }>(logger.sql`SELECT count(*) as count FROM events`)
        .then((rows) => rows[0]?.count ?? 0),
    getPaginatedEvents: (page: number, pageSize: number) =>
      logger.db.query<{ data: string; timestamp: string; type: string; version: string }>(
        logger.sql`SELECT "data", "timestamp", "type", "version" FROM events ORDER BY "timestamp" DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
      )
  },
  queries: {
    all: (page: number, pageSize: number) =>
      queryOptions({
        queryFn: () => events.fetchers.getPaginatedEvents(page, pageSize),
        queryKey: [...events.queries.base(), 'all', page, pageSize],
        staleTime: Infinity
      }),
    base: () => ['db', 'events'],
    count: () =>
      queryOptions({
        queryFn: () => events.fetchers.countEvents(),
        queryKey: [...events.queries.base(), 'count'],
        staleTime: Infinity
      })
  }
};

const chatPresets = {
  fetchers: {
    byId: (id: string) =>
      logger.db
        .query<TChatPreset>(logger.sql`SELECT * FROM chatPresets WHERE id = ${id}`)
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['settings'] });
          return rows.length > 0 ? rows[0] : null;
        }),
    getAllPresets: () =>
      logger.db
        .query<TChatPreset>(
          logger.sql`SELECT "createdAt", "id", "name", "settings" FROM chatPresets ORDER BY "createdAt" DESC`
        )
        .then((rows) => {
          parseDbRowsInPlace(rows, { jsonKeys: ['settings'] });
          return rows;
        })
  },
  queries: {
    all: () =>
      queryOptions({
        queryFn: () => chatPresets.fetchers.getAllPresets(),
        queryKey: [...chatPresets.queries.base(), 'all'],
        staleTime: Infinity
      }),
    base: () => ['db', 'chatPresets'],
    byId: (id: string) =>
      queryOptions({
        queryFn: () => chatPresets.fetchers.byId(id),
        queryKey: [...chatPresets.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

const documents = {
  fetchers: {
    all: () =>
      logger.db.query<TDocument>(
        logger.sql`SELECT "id", "name" FROM documents ORDER BY "createdAt" DESC`
      ),
    byId: (id: string) =>
      logger.db
        .query<TDocument>(logger.sql`SELECT * FROM documents WHERE id = ${id}`)
        .then((rows) => rows[0] ?? null)
  },
  queries: {
    all: () =>
      queryOptions({
        queryFn: () => documents.fetchers.all(),
        queryKey: [...documents.queries.base(), 'all'],
        staleTime: Infinity
      }),
    base: () => ['db', 'documents'],
    byId: (id: string) =>
      queryOptions({
        queryFn: () => documents.fetchers.byId(id),
        queryKey: [...documents.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

export const queries = {
  chatPresets: chatPresets.queries,
  chats: chats.queries,
  documents: documents.queries,
  events: events.queries,
  mcps: mcps.queries,
  models: models.queries,
  providers: providers.queries,
  userMetadata: userMetadata.queries
};

export const fetchers = {
  chatPresets: chatPresets.fetchers,
  chats: chats.fetchers,
  documents: documents.fetchers,
  events: events.fetchers,
  mcps: mcps.fetchers,
  providers: providers.fetchers,
  userMetadata: userMetadata.fetchers
};

QueryCacheManager.register(
  { queryKey: userMetadata.queries.base() },
  { queryKey: providers.queries.base() },
  { maxEntries: 3, queryKey: [...chats.queries.base(), 'byId'] },
  { queryKey: [...chats.queries.base(), 'all', 'minimal', 'paged'] },
  { queryKey: [...chats.queries.base(), 'all', 'recent'] },
  { queryKey: chatPresets.queries.base() },
  { queryKey: documents.queries.base() },
  {
    exclude: [[...mcps.queries.base(), 'all', 'clients']],
    queryKey: mcps.queries.base()
  }
);
