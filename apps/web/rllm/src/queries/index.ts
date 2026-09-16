import { infiniteQueryOptions, queryOptions } from '@tanstack/solid-query';

import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { db } from '~/db/client';
import { QueryCacheManager } from '~/lib/query-cache';

const FIVE_MINUTES_IN_MILLISECONDS = 5 * 60 * 1000;

/**
 * Caps a refetch at the first page: refetching every cached page costs one query per page, and the
 * pages after the first are reloaded as the list grows. v5 declares `pages` on the fetch options,
 * while `Query.fetch` reads it off the query's own options
 * (`infiniteQueryBehavior(this.options.pages)`), so it has to be spread into the query options.
 * A spread rather than a literal property: `infiniteQueryOptions` only type checks what it declares.
 */
const FIRST_PAGE_REFETCH: { pages: number } = { pages: 1 };

const userMetadata = {
  base: () => ['db', 'userMetadata'],
  corsProxyUrls: () =>
    queryOptions({
      queryFn: () => db.userMetadata.corsProxyUrls(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.CORS_PROXY_URL],
      staleTime: Infinity
    }),
  defaultChatSettingsPresetId: () =>
    queryOptions({
      queryFn: () => db.userMetadata.defaultChatSettingsPresetId(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET],
      staleTime: Infinity
    }),
  get: (id: string) =>
    queryOptions({
      queryFn: () => db.userMetadata.get(id),
      queryKey: [...userMetadata.base(), 'byId', id],
      staleTime: Infinity
    }),
  hideReasoningDuringGeneration: () =>
    queryOptions({
      queryFn: () => db.userMetadata.hideReasoningDuringGeneration(),
      queryKey: [
        ...userMetadata.base(),
        'byId',
        USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION
      ],
      staleTime: Infinity
    }),
  lastOpenedPage: () =>
    queryOptions({
      queryFn: () => db.userMetadata.lastOpenedPage(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.LAST_OPENED_PAGE],
      staleTime: Infinity
    }),
  scratchpadChat: () =>
    queryOptions({
      queryFn: () => db.userMetadata.scratchpadChat(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.SCRATCHPAD_CHAT],
      staleTime: Infinity
    }),
  selectedModelId: () =>
    queryOptions({
      queryFn: () => db.userMetadata.selectedModelId(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.SELECTED_MODEL_ID],
      staleTime: Infinity
    }),
  startupPage: () =>
    queryOptions({
      queryFn: () => db.userMetadata.startupPage(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.STARTUP_PAGE],
      staleTime: Infinity
    }),
  titleGenerationModelId: () =>
    queryOptions({
      queryFn: () => db.userMetadata.titleGenerationModelId(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.TITLE_GENERATION_MODEL_ID],
      staleTime: Infinity
    }),
  titleGenerationProviderId: () =>
    queryOptions({
      queryFn: () => db.userMetadata.titleGenerationProviderId(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.TITLE_GENERATION_PROVIDER_ID],
      staleTime: Infinity
    }),
  userDisplayName: () =>
    queryOptions({
      queryFn: () => db.userMetadata.userDisplayName(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.USER_DISPLAY_NAME],
      staleTime: Infinity
    }),
  webSearchMcpId: () =>
    queryOptions({
      queryFn: () => db.userMetadata.webSearchMcpId(),
      queryKey: [...userMetadata.base(), 'byId', USER_METADATA_KEYS.WEB_SEARCH_MCP_ID],
      staleTime: Infinity
    })
};

const providers = {
  all: () =>
    queryOptions({
      queryFn: () => db.providers.all(),
      queryKey: [...providers.base(), 'all'],
      staleTime: Infinity
    }),
  base: () => ['db', 'providers'],
  count: () =>
    queryOptions({
      queryFn: () => db.providers.count(),
      queryKey: [...providers.base(), 'all', 'count'],
      staleTime: Infinity
    }),
  first: () =>
    queryOptions({
      queryFn: () => db.providers.first(),
      queryKey: [...providers.base(), 'all', 'first'],
      staleTime: Infinity
    }),
  get: (id: null | string | undefined) =>
    queryOptions({
      queryFn: () => {
        if (!id) throw new Error(`Invalid id ${id}`);
        return db.providers.get(id);
      },
      queryKey: [...providers.base(), 'byId', id],
      staleTime: Infinity
    })
};

const models = {
  all: () => ['db', 'models', 'all'],
  base: () => ['db', 'models']
};

const chats = {
  all: () =>
    queryOptions({
      queryFn: () => db.chats.all(),
      queryKey: [...chats.base(), 'all'],
      staleTime: Infinity
    }),
  base: () => ['db', 'chats'],
  count: () =>
    queryOptions({
      queryFn: () => db.chats.count(),
      queryKey: [...chats.base(), 'all', 'count'],
      staleTime: FIVE_MINUTES_IN_MILLISECONDS
    }),
  countFiltered: ({ query, tags }: { query?: string; tags?: string[] }) =>
    queryOptions({
      queryFn: () => db.chats.countFiltered(query, tags),
      queryKey: [...chats.base(), 'all', { query, tags }, 'count'],
      staleTime: FIVE_MINUTES_IN_MILLISECONDS
    }),
  get: (id: string) =>
    queryOptions({
      queryFn: () => db.chats.get(id),
      queryKey: [...chats.base(), 'byId', id],
      staleTime: Infinity
    }),
  minimal: () =>
    queryOptions({
      queryFn: () => db.chats.minimal(),
      queryKey: [...chats.base(), 'all', 'minimal']
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
      ...FIRST_PAGE_REFETCH,
      queryFn: ({ pageParam }) => db.chats.pagedMinimal(pageSize, pageParam, query, tags),
      // oxlint-disable-next-line perfectionist/sort-objects
      getNextPageParam: (lastPage, _allPages, lastPageParam) =>
        lastPage.length < pageSize ? undefined : lastPageParam + pageSize,
      initialPageParam: 0,
      queryKey: [...chats.base(), 'all', 'minimal', 'paged', { pageSize, query, tags }]
    }),
  recent: (limit?: number) =>
    queryOptions({
      queryFn: () => db.chats.recent(limit),
      queryKey: [...chats.base(), 'all', 'recent', { limit }],
      staleTime: FIVE_MINUTES_IN_MILLISECONDS
    }),
  tags: () =>
    queryOptions({
      queryFn: () => db.chats.tags(),
      queryKey: [...chats.base(), 'all', 'tags'],
      staleTime: Infinity
    })
};

const mcps = {
  all: () =>
    queryOptions({
      queryFn: () => db.mcps.recent(),
      queryKey: [...mcps.base(), 'all'],
      staleTime: Infinity
    }),
  base: () => ['db', 'mcps'],
  get: (id: string) =>
    queryOptions({
      queryFn: () => db.mcps.get(id),
      queryKey: [...mcps.base(), 'byId', id],
      staleTime: Infinity
    })
};

const events = {
  all: (page: number, pageSize: number) =>
    queryOptions({
      queryFn: () => db.events.paginated(page, pageSize),
      queryKey: [...events.base(), 'all', page, pageSize],
      staleTime: Infinity
    }),
  base: () => ['db', 'events'],
  count: () =>
    queryOptions({
      queryFn: () => db.events.count(),
      queryKey: [...events.base(), 'count'],
      staleTime: Infinity
    })
};

const chatPresets = {
  all: () =>
    queryOptions({
      queryFn: () => db.chatPresets.all(),
      queryKey: [...chatPresets.base(), 'all'],
      staleTime: Infinity
    }),
  base: () => ['db', 'chatPresets'],
  get: (id: string) =>
    queryOptions({
      queryFn: () => db.chatPresets.get(id),
      queryKey: [...chatPresets.base(), 'byId', id],
      staleTime: Infinity
    })
};

const documents = {
  all: () =>
    queryOptions({
      queryFn: () => db.documents.all(),
      queryKey: [...documents.base(), 'all'],
      staleTime: Infinity
    }),
  base: () => ['db', 'documents'],
  get: (id: string) =>
    queryOptions({
      queryFn: () => db.documents.get(id),
      queryKey: [...documents.base(), 'byId', id],
      staleTime: Infinity
    })
};

export const queries = {
  chatPresets,
  chats,
  documents,
  events,
  mcps,
  models,
  providers,
  userMetadata
};

QueryCacheManager.register(
  { queryKey: userMetadata.base() },
  { queryKey: providers.base() },
  { maxEntries: 3, queryKey: [...chats.base(), 'byId'] },
  { queryKey: [...chats.base(), 'all', 'minimal', 'paged'] },
  { queryKey: [...chats.base(), 'all', 'recent'] },
  { queryKey: chatPresets.base() },
  { queryKey: documents.base() },
  {
    exclude: [[...mcps.base(), 'all', 'clients']],
    queryKey: mcps.base()
  }
);
