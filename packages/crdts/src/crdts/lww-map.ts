import { HLC } from 'hlc';
import { nanoid } from 'nanoid';

import { invariant } from '~/utils';

/** JSON discriminator identifying an {@link LWWMap} payload. */
export const LWW_MAP_JSON_IDENTIFIER = 'lww-map';

/**
 * Serialized form of an {@link LWWMap}: current entries plus per-key HLC
 * timestamps for the latest addition and removal.
 *
 * @typeParam T Type of the stored values.
 */
export type JSONLWWMap = {
  '@@crdt': typeof LWW_MAP_JSON_IDENTIFIER;
  id: string;
  map: Record<string, unknown>;
  timestamps: Record<string, JSONLWWMapValueState>;
};

/** Default merge replacer: the incoming value wins over the current one. */
const defaultReplacer = <T>(_: unknown, value: T) => value;

type JSONLWWMapValueState = [string, true] | [string];
type LWWMapValueState = [HLC, true] | [HLC];

/**
 * A last-writer-wins map: a `Map`-like collection where every key carries
 * its own add and removal HLC timestamps. On merge, each key resolves
 * independently to whichever operation has the newer timestamp, so removal
 * tombstones outlive the values they deleted and concurrent writes to
 * different keys never interfere.
 *
 * @typeParam T Type of the stored values.
 */
export class LWWMap<T extends Record<string, unknown>> {
  get map() {
    return new Proxy(this.#map, {
      deleteProperty() {
        return false;
      },
      set() {
        return false;
      }
    });
  }
  #id: string;
  #map: T;
  #timestamps: Map<string, LWWMapValueState>;

  /**
   * Creates a map seeded with `value`.
   *
   * @param value Initial entries.
   * @param config Optional restored state.
   * @param config.addedTimestamps Pre-existing add timestamps; when omitted, a fresh timestamp is generated for each seeded key.
   * @param config.id Replica id stamped into generated timestamps; random when omitted.
   * @param config.removedTimestamps Pre-existing removal tombstones; empty when omitted.
   */
  constructor(
    value: T,
    config: {
      id?: string;
      timestamps?: Map<string, LWWMapValueState>;
    } = {}
  ) {
    const { id, timestamps } = config;
    this.#id = id ?? nanoid();
    this.#map = value;
    if (timestamps) {
      this.#timestamps = timestamps;
    } else {
      this.#timestamps = new Map();
      for (const key of Object.keys(value)) {
        this.#timestamps.set(key, [HLC.generate(this.#id).increment()]);
      }
    }
  }
  /**
   * Rebuilds a map from a serialized payload
   *
   * @param json Value previously produced by {@link LWWMap#toJSON}.
   * @returns The restored map.
   * @throws If `json` is not a {@link JSONLWWMap} or a timestamp fails to parse.
   */
  static fromJSON<T extends Record<string, unknown>>(json: unknown) {
    invariant(this.isJsonLWWMap(json));
    const timestamps = new Map<string, LWWMapValueState>();
    for (const key in json.timestamps) {
      const [timestamp, tombstone] = json.timestamps[key]!;
      timestamps.set(
        key,
        tombstone ? [HLC.fromString(timestamp), true] : [HLC.fromString(timestamp)]
      );
    }
    return new LWWMap<T>(json.map as T, { id: json.id, timestamps });
  }
  /**
   * Type guard for {@link JSONLWWMap} payloads.
   *
   * @param value Value to test.
   * @returns `true` when `value` carries the LWWMap discriminator.
   */
  static isJsonLWWMap(value: unknown): value is JSONLWWMap {
    return (
      typeof value === 'object' &&
      value !== null &&
      '@@crdt' in value &&
      value['@@crdt'] === LWW_MAP_JSON_IDENTIFIER
    );
  }
  /**
   * Merges two maps into the first one.
   *
   * @param replica1 Target of the merge.
   * @param replica2 Source of the merge.
   * @param replacer Resolves an incoming value against the current one for accepted additions; defaults to taking the replica's value.
   * @returns `true` when the merge changed the target.
   */
  static mergeJSON<T extends Record<string, unknown>>(
    replica1: unknown,
    replica2: unknown,
    replacer: (key: string, value: T, current: T | undefined) => T = defaultReplacer
  ): boolean {
    invariant(this.isJsonLWWMap(replica1), 'replica1 is not a JSONLWWMap');
    invariant(this.isJsonLWWMap(replica2), 'replica2 is not a JSONLWWMap');
    let changed = false;
    for (const key in replica2.timestamps) {
      const [replicaTimestamp, replicaTombstone] = replica2.timestamps[key]!;
      const state = replica1.timestamps[key];
      const timestamp = state ? HLC.fromString(state[0]) : HLC.generate(replica1.id);
      if (timestamp.cmp(replicaTimestamp) > 0) continue;
      timestamp.receive(replicaTimestamp);
      replica1.timestamps[key] = replicaTombstone
        ? [timestamp.toString(), true]
        : [timestamp.toString()];
      if (replicaTombstone) {
        delete replica1.map[key];
      } else {
        (replica1.map as any)[key] = replacer(
          key,
          (replica2.map as any)[key]!,
          (replica1.map as any)[key]
        );
      }
      changed = true;
    }
    return changed;
  }
  /**
   * Removes `key`
   *
   * @param key Key to remove.
   */
  delete(key: string) {
    delete this.#map[key];
    const state = this.#timestamps.get(key);
    if (state) {
      state[0].increment();
      state[1] = true;
      return;
    }
    this.#timestamps.set(key, [HLC.generate(this.#id).increment(), true]);
  }
  /**
   * Looks up an entry.
   *
   * @param key Key to read.
   * @returns The value, or `undefined` when absent or removed.
   */
  get<K extends keyof T & string>(key: K): T[K] | undefined {
    return this.#map[key];
  }
  *keys() {
    for (const key in this.#map) {
      yield key;
    }
  }
  /**
   * Merges a remote map into this one
   *
   * @param replica Remote payload previously produced by {@link LWWMap#toJSON}.
   * @param replacer Resolves an incoming value against the current one for accepted additions; defaults to taking the replica's value.
   */
  receive(
    replica: JSONLWWMap,
    replacer: (key: string, value: T, current: T | undefined) => T = defaultReplacer
  ) {
    for (const key in replica.timestamps) {
      const [replicaTimestamp, replicaTombstone] = replica.timestamps[key]!;
      const state = this.#timestamps.get(key);
      const timestamp = state ? state[0] : HLC.generate(this.#id);
      if (timestamp.cmp(replicaTimestamp) > 0) continue;
      timestamp.receive(replicaTimestamp);
      this.#timestamps.set(key, replicaTombstone ? [timestamp, replicaTombstone] : [timestamp]);
      if (replicaTombstone) {
        delete this.#map[key];
      } else {
        (this.#map as any)[key] = replacer(
          key,
          (replica.map as any)[key]!,
          (this.#map as any)[key]
        );
      }
    }
  }
  /**
   * Stores `value` under `key`, stamping the write newer than any removal
   * tombstone so re-adding a deleted key wins.
   *
   * @param key Key to write.
   * @param value New value.
   */
  set<K extends keyof T & string>(key: K, value: T[K]) {
    (this.#map as any)[key] = value;
    const state = this.#timestamps.get(key);
    if (state) {
      state[0].increment();
      state.length = 1;
      return;
    }
    this.#timestamps.set(key, [HLC.generate(this.#id).increment()]);
  }
  /**
   * Serializes the entries and both timestamp sets, so future merges keep
   * their ordering after a round trip.
   *
   * @returns The JSON payload for {@link LWWMap.fromJSON}.
   */
  toJSON(): JSONLWWMap {
    const timestamps: Record<string, JSONLWWMapValueState> = {};
    for (const [key, [timestamp, tombstone]] of this.#timestamps.entries()) {
      timestamps[key] = tombstone ? [timestamp.toString(), true] : [timestamp.toString()];
    }
    return {
      '@@crdt': LWW_MAP_JSON_IDENTIFIER,
      id: this.#id,
      map: this.#map,
      timestamps
    };
  }
}
