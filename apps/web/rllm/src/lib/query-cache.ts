import { Debouncer } from '@tanstack/solid-pacer';
import type { DehydratedState, Query } from '@tanstack/solid-query';
import {
  defaultShouldDehydrateQuery,
  dehydrate,
  hashKey,
  hydrate,
  matchQuery
} from '@tanstack/solid-query';
import localforage from 'localforage';
import * as z from 'zod/mini';

import { queryClient } from '~/utils/query-client';

const QUERY_CACHE_KEY = 'rllm:query-cache';
const SNAPSHOT_LOCK_NAME = 'rllm:query-cache';
const LEGACY_QUERY_CACHE_WRITTEN_AT_KEY = 'rllm:query-cache:writtenAt';
const PERSISTENCE_VERSION = 1;
const WRITE_DEBOUNCE_MILLISECONDS = 2000;
const MAX_SNAPSHOT_AGE_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_MAX_BYTES = 512 * 1024;
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024;

const textEncoder = new TextEncoder();

const byteLength = (value: string): number => textEncoder.encode(value).byteLength;

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

type TDehydratedQuery = DehydratedState['queries'][number];

type TPersistedQueryCache = {
  appVersion: string;
  persistenceVersion: number;
  state: DehydratedState;
  writtenAt: number;
};

type TSelectedQueries = Map<string, { bytes: number; dataUpdatedAt: number }>;

const parsePersistedQueryCache = (value: unknown): null | TPersistedQueryCache => {
  const result = persistedQueryCacheSchema.safeParse(value);

  return result.success ? result.data : null;
};

export class QueryCacheManager {
  static #dirty = false;
  static #registrations = new Map<string, TQueryCacheRegistration>();
  static #revision = 0;
  static #unsubscribe: (() => void) | null = null;

  static #write = new Debouncer(() => this.#persist(), {
    leading: false,
    trailing: true,
    wait: WRITE_DEBOUNCE_MILLISECONDS
  });
  static clear(): Promise<void> {
    return this.#withSnapshotLock(async () => {
      this.#dirty = false;

      try {
        await Promise.all([
          localforage.removeItem(QUERY_CACHE_KEY),
          localforage.removeItem(LEGACY_QUERY_CACHE_WRITTEN_AT_KEY)
        ]);
      } catch (error) {
        console.debug('[Query Cache] Failed to clear persisted query cache', error);
      }
    });
  }

  static register(...registrations: TQueryCacheRegistration[]): void {
    for (const registration of registrations) {
      this.#registrations.set(hashKey(registration.queryKey), registration);
      // Restored entries revalidate when they are first mounted; letting the default gcTime collect
      // them before that would drop them from the next snapshot while still unobserved.
      queryClient.setQueryDefaults(registration.queryKey, { gcTime: Infinity });
    }
  }

  static async restore(): Promise<void> {
    try {
      await this.#readAndHydrate();
    } catch (error) {
      console.debug('[Query Cache] Failed to restore query cache', error);
    } finally {
      this.#subscribe();
    }
  }

  static start(): void {
    this.#subscribe();
    document.addEventListener('visibilitychange', this.#handleVisibilityChange);
  }

  static stop(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    document.removeEventListener('visibilitychange', this.#handleVisibilityChange);

    this.#write.cancel();
  }

  static unregister(queryKey: ReadonlyArray<unknown>): void {
    if (!this.#registrations.delete(hashKey(queryKey))) return;

    if (this.#registrations.size === 0) {
      void this.clear();
      return;
    }

    if (this.#unsubscribe) this.#markDirty();
  }

  /**
   * Stored rows whose live query is registered but cannot be dehydrated right now, so a transient
   * failure does not evict data that a later boot could still serve. Read from storage rather than
   * from this tab's last write, so rows another tab stored are carried over too.
   */
  static async #carriedOverQueries(selected: TSelectedQueries): Promise<TDehydratedQuery[]> {
    const unavailable = this.#unavailableRegisteredQueries(selected);
    if (unavailable.size === 0) return [];

    const value = await localforage.getItem<unknown>(QUERY_CACHE_KEY);
    const stored = parsePersistedQueryCache(value)?.state.queries;
    if (stored === undefined) return [];

    return stored.filter(({ queryHash }) => unavailable.has(queryHash));
  }

  static #enforceTotalBudget(selected: TSelectedQueries): TSelectedQueries {
    let total = 0;
    for (const { bytes } of selected.values()) total += bytes;
    if (total <= MAX_SNAPSHOT_BYTES) return selected;

    const oldestFirst = [...selected].sort(([, a], [, b]) => a.dataUpdatedAt - b.dataUpdatedAt);

    for (const [queryHash, { bytes }] of oldestFirst) {
      if (total <= MAX_SNAPSHOT_BYTES) break;

      selected.delete(queryHash);
      total -= bytes;
    }

    return selected;
  }

  static #handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.#writeNow();
  };

  static #isRegistered(query: Query): boolean {
    for (const registration of this.#registrations.values()) {
      if (this.#matches(query, registration)) return true;
    }

    return false;
  }

  static #markDirty(): void {
    this.#revision++;
    this.#dirty = true;
    this.#write.maybeExecute();
  }

  static #matches(query: Query, registration: TQueryCacheRegistration): boolean {
    if (!matchQuery({ queryKey: registration.queryKey }, query)) return false;

    return !registration.exclude?.some((prefix) => matchQuery({ queryKey: prefix }, query));
  }

  static #persist(): Promise<void> {
    return this.#withSnapshotLock(async () => {
      if (!this.#dirty) return;

      const revision = this.#revision;

      try {
        const selected = this.#selectQueries();
        // Never clobber an existing snapshot with an empty one.
        if (selected.size === 0) return;

        const state = dehydrate(queryClient, {
          shouldDehydrateQuery: (query) => selected.has(query.queryHash)
        });

        // A query that fails a refetch stops being dehydratable while still holding the best data we
        // have; carry the stored row over instead of dropping it from the snapshot.
        const carriedOver = await this.#carriedOverQueries(selected);
        if (carriedOver.length > 0) state.queries.push(...carriedOver);

        const envelope: TPersistedQueryCache = {
          appVersion: __VERSION__,
          persistenceVersion: PERSISTENCE_VERSION,
          state,
          writtenAt: Date.now()
        };

        await localforage.setItem(QUERY_CACHE_KEY, envelope);
      } catch (error) {
        console.debug('[Query Cache] Failed to persist query cache', error);
        return;
      }

      if (this.#revision === revision) {
        this.#dirty = false;
        return;
      }

      this.#write.maybeExecute();
    });
  }

  static async #readAndHydrate(): Promise<void> {
    const value = await localforage.getItem<unknown>(QUERY_CACHE_KEY);
    const persisted = parsePersistedQueryCache(value);
    const isUsable =
      persisted !== null && Date.now() - persisted.writtenAt <= MAX_SNAPSHOT_AGE_MILLISECONDS;

    if (!isUsable) {
      if (value != null) void this.clear();
      return;
    }

    hydrate(queryClient, persisted.state);

    for (const { queryHash } of persisted.state.queries) {
      queryClient.getQueryCache().get(queryHash)?.invalidate();
    }
  }

  static #selectQueries(): TSelectedQueries {
    const selected: TSelectedQueries = new Map();

    for (const registration of this.#registrations.values()) {
      let matches = queryClient
        .getQueryCache()
        .findAll({ queryKey: registration.queryKey })
        .filter((query) => defaultShouldDehydrateQuery(query))
        .filter((query) => this.#matches(query, registration));

      if (registration.maxEntries !== undefined) {
        matches = matches
          .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
          .slice(0, registration.maxEntries);
      }

      const maxBytes = registration.maxBytes ?? DEFAULT_MAX_BYTES;
      for (const query of matches) {
        const serialized = JSON.stringify(query.state.data);
        if (serialized === undefined) continue;

        const bytes = byteLength(serialized);
        if (bytes > maxBytes) continue;

        selected.set(query.queryHash, { bytes, dataUpdatedAt: query.state.dataUpdatedAt });
      }
    }

    return this.#enforceTotalBudget(selected);
  }

  static #subscribe(): void {
    this.#unsubscribe ??= queryClient.getQueryCache().subscribe(() => this.#markDirty());
  }

  /** Hashes of registered queries that cannot be dehydrated right now, so they never get selected. */
  static #unavailableRegisteredQueries(selected: TSelectedQueries): Set<string> {
    const unavailable = new Set<string>();

    for (const query of queryClient.getQueryCache().getAll()) {
      if (selected.has(query.queryHash) || defaultShouldDehydrateQuery(query)) continue;
      if (this.#isRegistered(query)) unavailable.add(query.queryHash);
    }

    return unavailable;
  }

  static #withSnapshotLock<T>(task: () => Promise<T>): Promise<T> {
    return navigator.locks.request(SNAPSHOT_LOCK_NAME, () => task());
  }

  static #writeNow(): void {
    this.#write.cancel();
    void this.#persist();
  }
}
