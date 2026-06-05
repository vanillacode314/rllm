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
        queryKey: ['db', 'userMetadata', 'byId', id],
        queryFn: () => userMetadata.fetchers.byId(id),
        staleTime: Infinity
      })
  }
};

const providers = {
  fetchers: {
    getAllProviders: () => db.select().from(tables.providers),
    countProviders: () =>
      db
        .select({ count: count() })
        .from(tables.providers)
        .then((rows) => rows[0]?.count ?? 0),
    byId: (id: string): Promise<null | TProvider> =>
      db
        .select()
        .from(tables.providers)
        .where(eq(tables.providers.id, id))
        .then((rows) => rows[0] ?? null)
  },
  queries: {
    base: () => ['db', 'providers'],
    all: () => {
      return Object.assign(
        queryOptions({
          queryKey: [...providers.queries.base(), 'all'],
          queryFn: () => providers.fetchers.getAllProviders().orderBy(tables.providers.name),
          staleTime: Infinity
        }),
        {
          _ctx: {
            count: queryOptions({
              queryKey: [...providers.queries.base(), 'all', 'count'],
              queryFn: () => providers.fetchers.countProviders(),
              staleTime: Infinity
            })
          }
        }
      );
    },
    byId: (id: null | string | undefined) =>
      queryOptions({
        queryKey: [...providers.queries.base(), 'byId', id],
        queryFn: () => {
          if (!id) throw new Error(`Invalid id ${id}`);
          return db
            .select()
            .from(tables.providers)
            .where(eq(tables.providers.id, id))
            .then((rows) => rows[0] ?? null);
        },
        staleTime: Infinity
      })
  }
};

const models = {
  queries: {
    base: () => ['db', 'models'],
    all: () => ['db', 'models', 'all']
  }
};

const chats = {
  fetchers: {
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
          title: tables.chats.title,
          tags: tables.chats.tags
        })
        .from(tables.chats)
        .orderBy(desc(tables.chats.createdAt)),
    getPagedMinimalChats: (limit: number, offset: number, query?: string, tags?: string[]) =>
      db
        .select({
          finished: tables.chats.finished,
          id: tables.chats.id,
          title: tables.chats.title,
          tags: tables.chats.tags,
          score:
            sql`${tables.chats.accessCount} * exp(-0.693 * (strftime('%s','now') - ${tables.chats.lastAccessedAt} / 1000) / 86400.0 / 7.0)`.as(
              'score'
            )
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
        .offset(offset),
    countChats: () =>
      db
        .select({ count: count() })
        .from(tables.chats)
        .then((rows) => rows[0]?.count ?? 0),
    byId: (id: string) =>
      db
        .select()
        .from(tables.chats)
        .where(eq(tables.chats.id, id))
        .then((rows) => rows[0] ?? null)
  },
  queries: {
    base: () => ['db', 'chats'],
    all: () =>
      Object.assign(
        queryOptions({
          queryKey: [...chats.queries.base(), 'all'],
          queryFn: () => chats.fetchers.getAllChats(),
          staleTime: Infinity
        }),
        {
          _ctx: {
            tags: queryOptions({
              queryKey: [...chats.queries.base(), 'all', 'tags'],
              queryFn: () => chats.fetchers.getChatTags(),
              staleTime: Infinity
            }),
            minimal: queryOptions({
              queryKey: [...chats.queries.base(), 'all', 'minimal'],
              queryFn: () => chats.fetchers.getMinimalChats()
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
                queryKey: [
                  ...chats.queries.base(),
                  'all',
                  'minimal',
                  'paged',
                  { pageSize, query, tags }
                ],
                queryFn: ({ pageParam }) =>
                  chats.fetchers.getPagedMinimalChats(pageSize, pageParam, query, tags),
                initialPageParam: 0,
                getNextPageParam: (lastPage, _allPages, lastPageParam) =>
                  lastPage.length < pageSize ? undefined : lastPageParam + pageSize
              }),
            count: () =>
              queryOptions({
                queryKey: [...chats.queries.base(), 'all', 'count'],
                queryFn: chats.fetchers.countChats,
                staleTime: 5 * 60 * 1000
              })
          }
        }
      ),
    byId: (id: string) =>
      queryOptions({
        queryKey: [...chats.queries.base(), 'byId', id],
        queryFn: () => chats.fetchers.byId(id),
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
    base: () => ['db', 'mcps'],
    all: () =>
      Object.assign(
        queryOptions({
          queryKey: [...mcps.queries.base(), 'all'],
          queryFn: () => mcps.fetchers.getAllMcps().orderBy(desc(tables.mcps.createdAt)),
          staleTime: Infinity
        }),
        {
          _ctx: {
            clients: (proxy?: null | string | undefined) =>
              queryOptions({
                queryKey: [...mcps.queries.base(), 'all', 'clients', { proxy }],
                queryFn: () => mcps.fetchers.getClients(proxy),
                staleTime: Infinity
              })
          }
        }
      ),
    byId: (id: string) =>
      queryOptions({
        queryKey: [...mcps.queries.base(), 'byId', id],
        queryFn: () =>
          db
            .select()
            .from(tables.mcps)
            .where(eq(tables.mcps.id, id))
            .then((rows) => rows[0] ?? null),
        staleTime: Infinity
      })
  }
};

const events = {
  fetchers: {
    getPaginatedEvents: (page: number, pageSize: number) =>
      db
        .select()
        .from(tables.events)
        .orderBy(desc(tables.events.timestamp))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    countEvents: () =>
      db
        .select({ count: count() })
        .from(tables.events)
        .then((rows) => rows[0]?.count ?? 0)
  },
  queries: {
    base: () => ['db', 'events'],
    all: (page: number, pageSize: number) =>
      queryOptions({
        queryKey: [...events.queries.base(), 'all', page, pageSize],
        queryFn: () => events.fetchers.getPaginatedEvents(page, pageSize),
        staleTime: Infinity
      }),
    count: () =>
      queryOptions({
        queryKey: [...events.queries.base(), 'count'],
        queryFn: () => events.fetchers.countEvents(),
        staleTime: Infinity
      })
  }
};

const chatPresets = {
  fetchers: {
    getAllPresets: () =>
      db.select().from(tables.chatPresets).orderBy(desc(tables.chatPresets.createdAt)),
    byId: (id: string) =>
      db
        .select()
        .from(tables.chatPresets)
        .where(eq(tables.chatPresets.id, id))
        .then((rows) => rows[0] ?? null)
  },
  queries: {
    base: () => ['db', 'chatPresets'],
    all: () =>
      queryOptions({
        queryKey: [...chatPresets.queries.base(), 'all'],
        queryFn: () => chatPresets.fetchers.getAllPresets(),
        staleTime: Infinity
      }),
    byId: (id: string) =>
      queryOptions({
        queryKey: [...chatPresets.queries.base(), 'byId', id],
        queryFn: () => chatPresets.fetchers.byId(id),
        staleTime: Infinity
      })
  }
};

export const queries = {
  userMetadata: userMetadata.queries,
  providers: providers.queries,
  mcps: mcps.queries,
  models: models.queries,
  chats: chats.queries,
  events: events.queries,
  chatPresets: chatPresets.queries
};

export const fetchers = {
  userMetadata: userMetadata.fetchers,
  providers: providers.fetchers,
  mcps: mcps.fetchers,
  events: events.fetchers,
  chats: chats.fetchers,
  chatPresets: chatPresets.fetchers
};
