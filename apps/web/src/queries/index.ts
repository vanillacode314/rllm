import { QueryClientContext, queryOptions, useQuery } from '@tanstack/solid-query';
import { count, desc, eq, sql } from 'drizzle-orm';
import { createComputed, useContext } from 'solid-js';

import { db } from '~/db/client';
import * as schema from '~/db/schema';
import { MCPClient } from '~/lib/mcp/client';
import { runCustomQuery } from '~/utils/db';
import { queryClient } from '~/utils/query-client';

const userMetadata = {
	fetchers: {
		byId: (id: string): Promise<null | string> =>
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
				queryKey: ['db', 'userMetadata', 'byId', id],
				queryFn: () => userMetadata.fetchers.byId(id),
				staleTime: Infinity
			})
	}
};

const providers = {
	fetchers: {
		getAllProviders: () => db.select().from(schema.providers),
		countProviders: () =>
			db
				.select({ count: count() })
				.from(schema.providers)
				.then((rows) => rows[0]?.count ?? 0),
		byId: (id: string): Promise<null | schema.TProvider> =>
			db
				.select()
				.from(schema.providers)
				.where(eq(schema.providers.id, id))
				.then((rows) => rows[0] ?? null)
	},
	queries: {
		base: () => ['db', 'providers'],
		all: () => {
			return Object.assign(
				queryOptions({
					queryKey: [...providers.queries.base(), 'all'],
					queryFn: () => providers.fetchers.getAllProviders().orderBy(schema.providers.name),
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
		selected: () => {
			const queryKey = [...providers.queries.base(), 'selected'];
			const ctx = useContext(QueryClientContext);
			const selectedProviderIdQuery =
				ctx ? useQuery(() => userMetadata.queries.byId('selected-provider-id')) : undefined;

			createComputed(() => {
				const $selectedProviderId =
					selectedProviderIdQuery?.isSuccess ? selectedProviderIdQuery.data : undefined;
				if ($selectedProviderId) queryClient.setQueryData(queryKey, $selectedProviderId);
			});

			return queryOptions({
				queryKey: [...providers.queries.base(), 'selected'],
				enabled: !!selectedProviderIdQuery?.data,
				queryFn: async () => {
					let selectedProviderId;
					if (!ctx || !selectedProviderIdQuery?.isSuccess)
						selectedProviderId =
							selectedProviderIdQuery?.data ??
							(await queryClient.ensureQueryData(
								userMetadata.queries.byId('selected-provider-id')
							));

					if (selectedProviderId) return selectedProviderId;

					const provider = await providers.fetchers
						.getAllProviders()
						.orderBy(desc(schema.providers.createdAt))
						.limit(1)
						.then((rows) => rows[0]);
					return provider!.id;
				},
				staleTime: Infinity
			});
		},
		byId: (id: string | undefined) =>
			queryOptions({
				queryKey: [...providers.queries.base(), 'byId', id],
				queryFn: () => {
					if (id === undefined) throw new Error('id was undefined');
					return db
						.select()
						.from(schema.providers)
						.where(eq(schema.providers.id, id))
						.then((rows) => rows[0] ?? null);
				},
				staleTime: Infinity
			})
	}
};

const models = {
	queries: {
		base: () => ['db', 'models'],
		all: () => ['db', 'models', 'all'],
		selected: () => {
			const queryKey = [...models.queries.base(), 'selected'];
			const ctx = useContext(QueryClientContext);
			const selectedModelIdQuery =
				ctx ? useQuery(() => userMetadata.queries.byId('selected-model-id')) : undefined;

			createComputed(() => {
				const $selectedModelId =
					selectedModelIdQuery?.isSuccess ? selectedModelIdQuery.data : undefined;
				if ($selectedModelId) queryClient.setQueryData(queryKey, $selectedModelId);
			});

			return queryOptions({
				queryKey,
				enabled: !!selectedModelIdQuery?.data,
				queryFn: async () => {
					let selectedModelId;
					if (!ctx || !selectedModelIdQuery?.isSuccess)
						selectedModelId =
							selectedModelIdQuery?.data ??
							(await queryClient.ensureQueryData(userMetadata.queries.byId('selected-model-id')));
					if (selectedModelId) return selectedModelId;
					const provider = await providers.fetchers
						.getAllProviders()
						.orderBy(desc(schema.providers.createdAt))
						.limit(1)
						.then((rows) => rows[0]);
					return provider!.defaultModelIds[0] ?? '';
				},
				staleTime: Infinity
			});
		}
	}
};

const chats = {
	queries: {
		base: () => ['db', 'chats'],
		all: () =>
			Object.assign(
				queryOptions({
					queryKey: [...chats.queries.base(), 'all'],
					queryFn: () => db.select().from(schema.chats),
					staleTime: Infinity
				}),
				{
					_ctx: {
						tags: queryOptions({
							queryKey: [...chats.queries.base(), 'all', 'tags'],
							queryFn: () =>
								runCustomQuery<{ value: string }>(
									sql`SELECT DISTINCT e.value FROM ${schema.chats} CROSS JOIN json_each(${schema.chats.tags}) AS e`
								).then((rows) => rows.map((row) => row.value)),
							staleTime: Infinity
						})
					}
				}
			),
		byId: (id: string) =>
			queryOptions({
				queryKey: [...chats.queries.base(), 'byId', id],
				queryFn: () =>
					db
						.select()
						.from(schema.chats)
						.where(eq(schema.chats.id, id))
						.then((rows) => rows[0] ?? null),
				staleTime: Infinity
			})
	}
};

const mcps = {
	fetchers: {
		getAllMcps: () => db.select().from(schema.mcps)
	},
	queries: {
		base: () => ['db', 'mcps'],
		all: () =>
			Object.assign(
				queryOptions({
					queryKey: [...mcps.queries.base(), 'all'],
					queryFn: () => mcps.fetchers.getAllMcps().orderBy(desc(schema.mcps.createdAt)),
					staleTime: Infinity
				}),
				{
					_ctx: {
						clients: (proxy?: null | string | undefined) =>
							queryOptions({
								queryKey: [...mcps.queries.base(), 'all', 'clients', { proxy }],
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
				queryKey: [...mcps.queries.base(), 'byId', id],
				queryFn: () =>
					db
						.select()
						.from(schema.mcps)
						.where(eq(schema.mcps.id, id))
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
