import { nanoid } from 'nanoid';

import { GCounter } from './crdts/g-counter.ts';
import { type JSONLWWMap, LWWMap } from './crdts/lww-map.ts';
import { createTracked, invariant, isObject } from './utils.ts';

/** JSON discriminator identifying a {@link JsonCRDT} payload. */
export const JSON_CRDT_JSON_IDENTIFIER = 'json';

/**
 * Serialized form of a {@link JsonCRDT}. Nested objects are serialized as
 * nested `PlainJsonCRDT`s inside the backing {@link JSONLWWMap}.
 */
export type PlainJsonCRDT = {
  '@@crdt': typeof JSON_CRDT_JSON_IDENTIFIER;
  id: string;
  map: JSONLWWMap;
};

type MaterializedJsonCRDT<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K] extends Record<string, unknown>
    ? MaterializedJsonCRDT<T[K]>
    : T[K] extends GCounter
      ? number
      : T[K];
};

/**
 * A CRDT view over a plain JSON object. Every key lives in an internal
 * {@link LWWMap}; nested objects become child {@link JsonCRDT} instances so
 * they merge independently, while primitives and arrays are single
 * last-writer-wins values (arrays are replaced wholesale, never merged
 * element-wise).
 *
 * @typeParam T Shape of the tracked object.
 */
export class JsonCRDT<T extends Record<string, unknown>> {
  #id: string;
  #map: LWWMap<T>;
  /**
   * Creates a CRDT over `object`.
   *
   * @param object Initial data; nested objects are wrapped recursively.
   * @param opts.id Replica id shared with child CRDTs; random when omitted.
   * @param opts.map Existing backing map that seeds the instance in place of `object`.
   */
  constructor(object: T, { id, map }: { id?: string; map?: LWWMap<T> } = {}) {
    this.#id = id ?? nanoid();
    this.#map = map ?? new LWWMap(this.#build(object, this.#id), { id: this.#id });
  }
  /**
   * Rebuilds a CRDT from a serialized payload, recursively wrapping nested
   * objects that carry the CRDT discriminator.
   *
   * @param json Payload previously produced by {@link JsonCRDT#toJSON}.
   * @returns The restored CRDT.
   */
  static fromJSON<T extends Record<string, unknown>>(json: unknown): JsonCRDT<T> {
    invariant(this.isPlainJsonCRDT(json), 'invalid json');
    const map = {} as Record<string, unknown>;
    for (const key in json.map.map) {
      const value = json.map.map[key];
      if (this.isPlainJsonCRDT(value)) {
        map[key] = JsonCRDT.fromJSON(value as PlainJsonCRDT);
        continue;
      }
      if (GCounter.isJsonGCounter(value)) {
        map[key] = GCounter.fromJSON(value);
        continue;
      }
      map[key] = value;
    }
    // `map` fully seeds the instance, so the initial object is unused here
    return new JsonCRDT<T>({} as T, {
      id: json.id,
      map: LWWMap.fromJSON({ ...json.map, map })
    });
  }
  /**
   * Type guard for {@link PlainJsonCRDT} payloads.
   *
   * @param value Value to test.
   * @returns `true` when `value` carries the JSON CRDT discriminator.
   */
  static isPlainJsonCRDT(value: unknown): value is PlainJsonCRDT {
    return (
      typeof value === 'object' &&
      value !== null &&
      '@@crdt' in value &&
      value['@@crdt'] === JSON_CRDT_JSON_IDENTIFIER
    );
  }
  static mergeJSON(replica1: unknown, replica2: unknown): boolean {
    invariant(this.isPlainJsonCRDT(replica1), 'invalid replica1');
    invariant(this.isPlainJsonCRDT(replica2), 'invalid replica2');
    return LWWMap.mergeJSON(replica1.map, replica2.map, (_, value, current) => {
      if (Array.isArray(value)) {
        return structuredClone(value);
      }
      if (JsonCRDT.isPlainJsonCRDT(value)) {
        const crdt = this.isPlainJsonCRDT(current)
          ? current
          : new JsonCRDT({}, { id: replica1.id }).toJSON();
        this.mergeJSON(crdt, value);
        return crdt;
      }
      if (GCounter.isJsonGCounter(value)) {
        const counter = GCounter.isJsonGCounter(current)
          ? current
          : new GCounter({ id: replica1.id }).toJSON();
        GCounter.mergeJSON(counter, value);
        return counter;
      }
      return value;
    });
  }
  /**
   * Materializes the current state as a plain object, recursively expanding
   * child CRDTs.
   *
   * @returns A detached copy; do not mutate this directly, use {@link JsonCRDT.update} instead.
   */
  get() {
    return new Proxy(this.#map.map, {
      get(target, key) {
        if (typeof key !== 'string') return undefined;
        const value = target[key];
        if (value instanceof JsonCRDT) {
          return value.get();
        }
        if (value instanceof GCounter) {
          return value.get();
        }
        return value;
      }
    }) as MaterializedJsonCRDT<T>;
  }
  /**
   * Merges a remote payload into this CRDT. Nested CRDT payloads merge
   * recursively into existing children, arrays are deep-cloned to keep the
   * register immutable, and all other values replace theirs by timestamp.
   *
   * @param replica Payload previously produced by {@link JsonCRDT#toJSON}.
   */
  merge(replica: PlainJsonCRDT) {
    this.#map.receive(replica.map, (_, value, current) => {
      if (JsonCRDT.isPlainJsonCRDT(value)) {
        const crdt = current instanceof JsonCRDT ? current : new JsonCRDT({}, { id: this.#id });
        crdt.merge(value);
        return crdt as any;
      }
      if (GCounter.isJsonGCounter(value)) {
        const counter = current instanceof GCounter ? current : new GCounter({ id: this.#id });
        counter.receive(value);
        return counter as any;
      }
      if (Array.isArray(value)) {
        return structuredClone(value);
      }
      return value;
    });
  }
  /**
   * Serializes this CRDT and its children into a self-describing payload.
   *
   * @returns The JSON payload for {@link JsonCRDT.fromJSON}.
   */
  toJSON(): PlainJsonCRDT {
    const map = this.#map.toJSON();
    for (const key in map.map) {
      const value = map.map[key];
      if (value instanceof JsonCRDT || value instanceof GCounter) {
        map.map[key] = value.toJSON();
      }
    }
    return {
      '@@crdt': JSON_CRDT_JSON_IDENTIFIER,
      id: this.#id,
      map
    };
  }
  /**
   * Applies `fn` to a tracked draft of the current state and writes every
   * mutation back by property path: added or replaced objects become child
   * CRDTs, deletions remove map keys, and assigned arrays replace wholesale.
   *
   * @param fn Callback receiving a proxy draft of {@link JsonCRDT.get}; do not retain it past the callback.
   */
  update(fn: (value: T) => void) {
    const onUpdate = (path: PropertyKey[], value: unknown) => {
      const key = path.at(-1);
      invariant(typeof key === 'string', 'key must be a string');
      const parent = this.#parentForPath(path);
      parent.#map.set(key, isObject(value) ? new JsonCRDT(value, { id: this.#id }) : value);
    };
    const onRemove = (path: PropertyKey[]) => {
      const key = path.at(-1);
      invariant(typeof key === 'string', 'key must be a string');
      const parent = this.#parentForPath(path);
      parent.#map.delete(key);
    };
    fn(
      createTracked(this.#raw(), {
        onAdd: onUpdate,
        onRemove: onRemove,
        onReplace: onUpdate,
        treatArraysAsPrimitives: true
      })
    );
  }
  /**
   * Converts each nested object of `object` into a child CRDT; everything
   * else is stored as-is.
   *
   * @param object Source data.
   * @param id Replica id given to every child.
   * @returns Entry map for the backing {@link LWWMap}.
   */
  #build(object: T, id: string) {
    const map = {} as Record<string, unknown>;
    for (const key in object) {
      const value = object[key];
      if (isObject(value)) {
        map[key] = new JsonCRDT(value, { id });
        continue;
      }
      map[key] = value;
    }
    return map as T;
  }
  #parentForPath(path: PropertyKey[]) {
    return path.slice(0, -1).reduce(
      (acc, key) => {
        invariant(typeof key === 'string', 'key must be a string');
        const value = acc.#map.get(key);
        invariant(value instanceof JsonCRDT, 'value must be a JsonCRDT');
        return value;
      },
      this as JsonCRDT<Record<string, unknown>>
    );
  }
  #raw() {
    return new Proxy(this.#map.map, {
      get(target, key) {
        if (typeof key !== 'string') return undefined;
        const value = target[key];
        if (value instanceof JsonCRDT) {
          return value.#raw();
        }
        return value;
      }
    });
  }
}
export { LWWMap } from './crdts/lww-map.ts';
export { LWWValue } from './crdts/lww-value.ts';
