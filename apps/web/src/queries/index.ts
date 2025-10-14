import { queryOptions } from '@tanstack/solid-query';
import { and, count, desc, eq } from 'drizzle-orm';

import { db } from '~/db/client';
import * as schema from '~/db/schema';
import { MCPClient } from '~/utils/mcp/client';

const userMetadata = {
	fetchers: {
		byId: (id: string) =>
			db
				.select({ value: schema.userMetadata.value })
				.from(schema.userMetadata)
				.where(eq(schema.userMetadata.id, id))
				.then((rows) => rows[0]?.value ?? null),
		staleTime: Infinity
	},
	queries: {
		byId: (id: string) =>
			queryOptions({
				queryKey: ['db', 'user-metadata', 'byId', id],
				queryFn: () => userMetadata.fetchers.byId(id),
				staleTime: Infinity
			})
	}
};

const providers = {
	fetchers: {
		getAllProviders: () =>
			db.select().from(schema.providers).where(eq(schema.providers.deleted, false)),
		countProviders: () =>
			db
				.select({ count: count() })
				.from(schema.providers)
				.where(eq(schema.providers.deleted, false))
				.then((rows) => rows[0]?.count ?? 0)
	},
	queries: {
		all: () => {
			return Object.assign(
				queryOptions({
					queryKey: ['db', 'providers'],
					queryFn: () => providers.fetchers.getAllProviders().orderBy(schema.providers.name),
					staleTime: Infinity
				}),
				{
					_ctx: {
						count: queryOptions({
							queryKey: ['db', 'providers', 'count'],
							queryFn: () => providers.fetchers.countProviders(),
							staleTime: Infinity
						})
					}
				}
			);
		},
		selected: () =>
			queryOptions({
				queryKey: [...providers.queries.all().queryKey, 'selected'],
				queryFn: async () => {
					const selectedProviderId = await userMetadata.fetchers.byId('selected-provider-id');
					outer: if (selectedProviderId) {
						const provider = await db
							.select()
							.from(schema.providers)
							.where(eq(schema.providers.id, selectedProviderId));
						if (provider.length === 0) break outer;
						return selectedProviderId;
					}
					const provider = await providers.fetchers
						.getAllProviders()
						.orderBy(desc(schema.providers.createdAt))
						.limit(1)
						.then((rows) => rows[0]);
					return provider!.id;
				},
				staleTime: Infinity
			}),
		byId: (id: string | undefined) =>
			queryOptions({
				queryKey: [...providers.queries.all().queryKey, 'byId', id],
				queryFn: () => {
					if (id === undefined) throw new Error('id was undefined');
					return db
						.select()
						.from(schema.providers)
						.where(and(eq(schema.providers.deleted, false), eq(schema.providers.id, id)))
						.then((rows) => rows[0] ?? null);
				},
				staleTime: Infinity
			})
	}
};

const models = {
	queries: {
		all: () => ['db', 'models'],
		selected: () =>
			queryOptions({
				queryKey: [...models.queries.all(), 'selected'],
				queryFn: async () => {
					const selectedModelId = await userMetadata.fetchers.byId('selected-model-id');
					if (selectedModelId) return selectedModelId;
					const provider = await providers.fetchers
						.getAllProviders()
						.orderBy(desc(schema.providers.createdAt))
						.limit(1)
						.then((rows) => rows[0]);
					return provider!.defaultModelIds[0] ?? '';
				},
				staleTime: Infinity
			})
	}
};

const chats = {
	queries: {
		all: () =>
			queryOptions({
				queryKey: ['db', 'chats'],
				queryFn: () => db.select().from(schema.chats).where(eq(schema.chats.deleted, false)),
				staleTime: Infinity
			}),
		byId: (id: string) =>
			queryOptions({
				queryKey: [...chats.queries.all().queryKey, 'byId', id],
				queryFn: () =>
					db
						.select()
						.from(schema.chats)
						.where(and(eq(schema.chats.deleted, false), eq(schema.chats.id, id)))
						.then((rows) => rows[0] ?? null),
				staleTime: Infinity
			})
	}
};

const mcps = {
	fetchers: {
		getAllMcps: () => db.select().from(schema.mcps).where(eq(schema.mcps.deleted, false))
	},
	queries: {
		all: () =>
			Object.assign(
				queryOptions({
					queryKey: ['db', 'mcps'],
					queryFn: () => mcps.fetchers.getAllMcps().orderBy(desc(schema.mcps.createdAt)),
					staleTime: Infinity
				}),
				{
					_ctx: {
						clients: (proxy?: string | undefined) =>
							queryOptions({
								queryKey: ['db', 'mcps', 'clients', { proxy }],
								queryFn: async () => {
									const $mcps = await mcps.fetchers.getAllMcps().orderBy(schema.mcps.name);
									return $mcps.map(
										(mcp) => new MCPClient(mcp.name, proxy ? proxy.replace('%s', mcp.url) : mcp.url)
									);
								},
								staleTime: Infinity
							})
					}
				}
			),
		byId: (id: string) =>
			queryOptions({
				queryKey: [...mcps.queries.all().queryKey, 'byId', id],
				queryFn: () =>
					db
						.select()
						.from(schema.mcps)
						.where(and(eq(schema.mcps.deleted, false), eq(schema.mcps.id, id)))
						.then((rows) => rows[0] ?? null),
				staleTime: Infinity
			})
	}
};

export const queries = {
	userMetadata: userMetadata.queries,
	providers: providers.queries,
	mcps: mcps.queries,
	models: models.queries,
	chats: chats.queries
};

export const fetchers = {
	userMetadata: userMetadata.fetchers,
	providers: providers.fetchers,
	mcps: mcps.fetchers
};
