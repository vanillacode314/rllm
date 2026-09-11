import { Debouncer } from '@tanstack/solid-pacer';
import type { DehydratedState } from '@tanstack/solid-query';
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  hashKey,
  hydrate,
  matchQuery
} from '@tanstack/solid-query';
import localforage from 'localforage';
import * as z from 'zod/mini';

import { TimeoutError, withTimeout } from '~/utils/promises';
import { queryClient } from '~/utils/query-client';

const QUERY_CACHE_KEY = 'rllm:query-cache';
const QUERY_CACHE_WRITTEN_AT_KEY = 'rllm:query-cache:writtenAt';
const PERSISTENCE_VERSION = 1;
const RESTORE_TIMEOUT_MILLISECONDS = 250;
const WRITE_DEBOUNCE_MILLISECONDS = 2000;
const MAX_SNAPSHOT_AGE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 512 * 1024;

// Loose objects throughout: `hydrate` reads fields beyond the ones checked here (queryHash, status,
// meta, ...), so validation must not strip them.
const persistedStateSchema = z.looseObject({
  mutations: z.array(z.unknown()),
  queries: z.array(
    z.looseObject({
      queryKey: z.array(z.unknown()),
      state: z.looseObject({ data: z.optional(z.unknown()), dataUpdatedAt: z.number() })
    })
  )
});

const persistedQueryCacheSchema = z.looseObject({
  appVersion: z.literal(__VERSION__),
  persistenceVersion: z.literal(PERSISTENCE_VERSION),
  state: z.custom<DehydratedState>((value) => persistedStateSchema.safeParse(value).success),
  writtenAt: z.number()
});

export type TQueryCacheRegistration = {
  exclude?: ReadonlyArray<ReadonlyArray<unknown>>;
  maxBytes?: number;
  maxEntries?: number;
  queryKey: ReadonlyArray<unknown>;
};

type TPersistedQueryCache = {
  appVersion: string;
  persistenceVersion: number;
  state: DehydratedState;
  writtenAt: number;
};

const parsePersistedQueryCache = (value: unknown): null | TPersistedQueryCache => {
  const result = persistedQueryCacheSchema.safeParse(value);

  return result.success ? result.data : null;
};

export class QueryCacheManager {
  static #registrations = new Map<string, TQueryCacheRegistration>();

  static #unsubscribe: (() => void) | null = null;

  static #write = new Debouncer(() => this.#persist(), {
    leading: false,
    trailing: true,
    wait: WRITE_DEBOUNCE_MILLISECONDS
  });
  static async clear(): Promise<void> {
    try {
      await Promise.all([
        localforage.removeItem(QUERY_CACHE_KEY),
        localforage.removeItem(QUERY_CACHE_WRITTEN_AT_KEY)
      ]);
    } catch (error) {
      console.debug('[Query Cache] Failed to clear persisted query cache', error);
    }
  }

  static register(...registrations: TQueryCacheRegistration[]): void {
    for (const registration of registrations) {
      this.#registrations.set(hashKey(registration.queryKey), registration);
    }
  }

  static async restore(): Promise<void> {
    const controller = new AbortController();

    try {
      await withTimeout(this.#readAndHydrate(controller.signal), RESTORE_TIMEOUT_MILLISECONDS);
    } catch (error) {
      controller.abort();
      if (!(error instanceof TimeoutError)) {
        console.debug('[Query Cache] Failed to restore query cache', error);
      }
    }
  }

  static start(): void {
    if (this.#unsubscribe) return;

    this.#unsubscribe = queryClient.getQueryCache().subscribe(() => this.#write.maybeExecute());
    document.addEventListener('visibilitychange', this.#handleVisibilityChange);

    this.#writeNow();
  }

  static stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange);

    this.#write.cancel();
  }

  /**
   * Stops persisting queries matching `queryKey`. Remaining registrations drop those keys on the
   * next write; removing the last one clears the snapshot, since nothing could restore it anyway.
   */
  static unregister(queryKey: ReadonlyArray<unknown>): void {
    if (!this.#registrations.delete(hashKey(queryKey))) return;

    if (this.#registrations.size === 0) {
      void this.clear();
      return;
    }

    if (this.#unsubscribe) this.#write.maybeExecute();
  }

  static async #areWeStale(state: DehydratedState) {
    const freshness = state.queries.reduce(
      (latest, query) => Math.max(latest, query.state.dataUpdatedAt),
      Number.NEGATIVE_INFINITY
    );
    if (!Number.isFinite(freshness)) return null;
    const writtenAt = await this.#readWrittenAt();
    return writtenAt !== null && writtenAt >= freshness;
  }

  static #handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.#writeNow();
  };

  static async #persist(): Promise<void> {
    try {
      const selected = this.#selectQueries();
      // Never clobber an existing snapshot with an empty one.
      if (selected.size === 0) return;

      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => selected.has(query.queryHash)
      });

      const staleness = await this.#areWeStale(state);
      if (staleness === null || staleness) return;

      const envelope: TPersistedQueryCache = {
        appVersion: __VERSION__,
        persistenceVersion: PERSISTENCE_VERSION,
        state,
        writtenAt: Date.now()
      };

      await localforage.setItem(QUERY_CACHE_KEY, envelope);
      await localforage.setItem(QUERY_CACHE_WRITTEN_AT_KEY, envelope.writtenAt);
    } catch (error) {
      console.debug('[Query Cache] Failed to persist query cache', error);
    }
  }

  static async #readAndHydrate(signal: AbortSignal): Promise<void> {
    const value = await localforage.getItem<unknown>(QUERY_CACHE_KEY);
    if (signal.aborted) return;

    const persisted = parsePersistedQueryCache(value);
    const isUsable =
      persisted !== null && Date.now() - persisted.writtenAt <= MAX_SNAPSHOT_AGE_MILLISECONDS;

    if (!isUsable) {
      if (value != null) void this.clear();
      return;
    }

    if (signal.aborted) return;

    hydrate(queryClient, persisted.state);
  }

  static async #readWrittenAt(): Promise<null | number> {
    const writtenAt = await localforage.getItem<unknown>(QUERY_CACHE_WRITTEN_AT_KEY);

    return typeof writtenAt === 'number' && Number.isFinite(writtenAt) ? writtenAt : null;
  }

  static #selectQueries(): Set<string> {
    const selected = new Set<string>();

    for (const registration of this.#registrations.values()) {
      let matches = queryClient
        .getQueryCache()
        .findAll({ queryKey: registration.queryKey })
        .filter((query) => defaultShouldDehydrateQuery(query))
        .filter(
          (query) =>
            !registration.exclude?.some((prefix) => matchQuery({ queryKey: prefix }, query))
        );

      if (registration.maxEntries !== undefined) {
        matches = matches
          .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
          .slice(0, registration.maxEntries);
      }

      const maxBytes = registration.maxBytes ?? DEFAULT_MAX_BYTES;
      for (const query of matches) {
        const serialized = JSON.stringify(query.state.data);
        if (serialized === undefined || serialized.length > maxBytes) continue;

        selected.add(query.queryHash);
      }
    }

    return selected;
  }

  static #writeNow(): void {
    this.#write.cancel();
    void this.#persist();
  }
}
