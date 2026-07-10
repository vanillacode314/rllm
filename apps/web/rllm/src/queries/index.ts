import { infiniteQueryOptions, queryOptions } from '@tanstack/solid-query';
import { and, count, desc, eq, exists, inArray, like, sql } from 'drizzle-orm';

import type { TProvider } from '~/db/app-schema';

import { db } from '~/db/client';
import { tables } from '~/db/schema';
import { MCPClient } from '~/lib/mcp/client';
import { runCustomQuery } from '~/utils/db';

const userMetadata = {
  fetchers: {
    byId: (id: string): Promise<null | string> =>
      db
        .select({ value: tables.userMetadata.value })
        .from(tables.userMetadata)
        .where(eq(tables.userMetadata.id, id))
        .then((rows) => rows[0]?.value ?? null),
    staleTime: Infinity
  },
  queries: {
    byId: (id: string) =>
      queryOptions({
        queryFn: () => userMetadata.fetchers.byId(id),
        queryKey: ['db', 'userMetadata', 'byId', id],
        staleTime: Infinity
      })
  }
};

const providers = {
  fetchers: {
    byId: (id: string): Promise<null | TProvider> =>
      db
        .select()
        .from(tables.providers)
        .where(eq(tables.providers.id, id))
        .then((rows) => rows[0] ?? null),
    countProviders: () =>
      db
        .select({ value: sql`count(*)`.as('value') })
        .from(tables.providers)
        .then((rows) => rows[0]?.value ?? 0),
    getAllProviders: () => db.select().from(tables.providers)
  },
  queries: {
    all: () => {
      return Object.assign(
        queryOptions({
          queryFn: () => providers.fetchers.getAllProviders().orderBy(tables.providers.name),
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
          return db
            .select()
            .from(tables.providers)
            .where(eq(tables.providers.id, id))
            .then((rows) => rows[0] ?? null);
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
      db
        .select()
        .from(tables.chats)
        .where(eq(tables.chats.id, id))
        .then((rows) => rows[0] ?? null),
    countChats: () =>
      db
        .select({ count: count() })
        .from(tables.chats)
        .then((rows) => rows[0]?.count ?? 0),
    getAllChats: () => db.select().from(tables.chats).orderBy(desc(tables.chats.createdAt)),
    getChatTags: () =>
      runCustomQuery<{ value: string }>(
        sql`SELECT DISTINCT e.value FROM ${tables.chats} CROSS JOIN json_each(${tables.chats.tags}) AS e`
      ).then((rows) => rows.map((row) => row.value)),
    getMinimalChats: () =>
      db
        .select({
          finished: tables.chats.finished,
          id: tables.chats.id,
          tags: tables.chats.tags,
          title: tables.chats.title
        })
        .from(tables.chats)
        .orderBy(desc(tables.chats.createdAt)),
    getPagedMinimalChats: (limit: number, offset: number, query?: string, tags?: string[]) =>
      db
        .select({
          finished: tables.chats.finished,
          id: tables.chats.id,
          score:
            sql`${tables.chats.accessCount} * MAX(0, 1 - (strftime('%s','now') - (${tables.chats.lastAccessedAt} / 1000.0)) / (86400.0 * 7))`.as(
              'score'
            ),
          tags: tables.chats.tags,
          title: tables.chats.title
        })
        .from(tables.chats)
        .where(
          and(
            like(sql`LOWER(${tables.chats.title})`, `%${query?.toLowerCase()}%`).if(
              query && query.trim().length > 0
            ),
            exists(
              db
                .select({ value: sql`1` })
                .from(sql`json_each(${tables.chats.tags})`)
                .where(
                  inArray(
                    sql`LOWER(json_each.value)`,
                    tags?.filter((tag) => tag.trim().length > 0).map((tag) => tag.toLowerCase()) ??
                      []
                  )
                )
            ).if(tags && tags.filter((tag) => tag.trim().length > 0).length > 0)
          )
        )
        .orderBy(
          sql`score desc`,
          desc(tables.chats.lastAccessedAt),
          desc(tables.chats.createdAt),
          sql`score is null`
        )
        .limit(limit)
        .offset(offset)
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
                staleTime: 5 * 60 * 1000
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
                getNextPageParam: (lastPage, _allPages, lastPageParam) =>
                  lastPage.length < pageSize ? undefined : lastPageParam + pageSize,
                initialPageParam: 0,
                queryFn: ({ pageParam }) =>
                  chats.fetchers.getPagedMinimalChats(pageSize, pageParam, query, tags),
                queryKey: [
                  ...chats.queries.base(),
                  'all',
                  'minimal',
                  'paged',
                  { pageSize, query, tags }
                ]
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
    getAllMcps: () => db.select().from(tables.mcps),
    getClients: (proxy?: null | string | undefined) =>
      mcps.fetchers
        .getAllMcps()
        .orderBy(tables.mcps.name)
        .then((mcps) =>
          mcps.map((mcp) => new MCPClient(mcp.name, proxy ? proxy.replace('%s', mcp.url) : mcp.url))
        )
  },
  queries: {
    all: () =>
      Object.assign(
        queryOptions({
          queryFn: () => mcps.fetchers.getAllMcps().orderBy(desc(tables.mcps.createdAt)),
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
          db
            .select()
            .from(tables.mcps)
            .where(eq(tables.mcps.id, id))
            .then((rows) => rows[0] ?? null),
        queryKey: [...mcps.queries.base(), 'byId', id],
        staleTime: Infinity
      })
  }
};

const events = {
  fetchers: {
    countEvents: () =>
      db
        .select({ count: count() })
        .from(tables.events)
        .then((rows) => rows[0]?.count ?? 0),
    getPaginatedEvents: (page: number, pageSize: number) =>
      db
        .select()
        .from(tables.events)
        .orderBy(desc(tables.events.timestamp))
        .limit(pageSize)
        .offset((page - 1) * pageSize)
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
      db
        .select()
        .from(tables.chatPresets)
        .where(eq(tables.chatPresets.id, id))
        .then((rows) => rows[0] ?? null),
    getAllPresets: () =>
      db.select().from(tables.chatPresets).orderBy(desc(tables.chatPresets.createdAt))
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

export const queries = {
  chatPresets: chatPresets.queries,
  chats: chats.queries,
  events: events.queries,
  mcps: mcps.queries,
  models: models.queries,
  providers: providers.queries,
  userMetadata: userMetadata.queries
};

export const fetchers = {
  chatPresets: chatPresets.fetchers,
  chats: chats.fetchers,
  events: events.fetchers,
  mcps: mcps.fetchers,
  providers: providers.fetchers,
  userMetadata: userMetadata.fetchers
};
