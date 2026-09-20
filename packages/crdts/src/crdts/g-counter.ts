import { nanoid } from 'nanoid';

import { invariant } from '~/utils';

export const G_COUNTER_JSON_IDENTIFIER = 'g-counter';

export type JSONGCounter = {
  '@@crdt': typeof G_COUNTER_JSON_IDENTIFIER;
  counts: Record<string, number>;
  id: string;
};

export class GCounter {
  get id() {
    return this.#id;
  }
  #counts: Map<string, number>;
  readonly #id: string;
  #subscribers = new Set<() => void>();
  constructor(opts: { counts?: Map<string, number>; id?: string } = {}) {
    const { counts, id } = opts;
    this.#id = id ?? nanoid();
    if (!counts) {
      this.#counts = new Map();
      this.#counts.set(this.#id, 0);
      return;
    }
    this.#counts = counts;
    if (!counts.has(this.#id)) {
      this.#counts.set(this.#id, 0);
    }
  }
  static fromJSON(json: unknown) {
    invariant(this.isJsonGCounter(json), 'invalid json');
    const counts = new Map<string, number>();
    for (const key in json.counts) {
      const value = json.counts[key]!;
      if (Number.isInteger(value)) {
        counts.set(key, value);
      }
    }
    return new GCounter({ counts, id: json.id });
  }
  static isJsonGCounter(value: unknown): value is JSONGCounter {
    return (
      typeof value === 'object' &&
      value !== null &&
      '@@crdt' in value &&
      value['@@crdt'] === G_COUNTER_JSON_IDENTIFIER
    );
  }
  static mergeJSON(replica1: JSONGCounter, replica2: JSONGCounter): boolean {
    let changed = false;
    for (const key in replica2.counts) {
      const theirs = replica2.counts[key]!;
      if (!Number.isInteger(theirs)) continue;
      const ours = replica1.counts[key] ?? 0;
      if (theirs > ours) {
        changed = true;
        replica1.counts[key] = theirs;
      }
    }
    return changed;
  }
  get() {
    let n = 0;
    for (const count of this.#counts.values()) {
      n += count;
    }
    return n;
  }
  increment(n: number = 1) {
    const current = this.#counts.get(this.#id)!;
    this.#counts.set(this.#id, current + n);
    for (const fn of this.#subscribers) {
      fn();
    }
  }
  onChange(fn: () => void) {
    this.#subscribers.add(fn);
    return () => this.#subscribers.delete(fn);
  }
  receive(replica: JSONGCounter): boolean {
    let changed = false;
    for (const key in replica.counts) {
      const theirs = replica.counts[key]!;
      if (!Number.isInteger(theirs)) continue;
      const ours = this.#counts.get(key) ?? 0;
      if (theirs > ours) {
        changed = true;
        this.#counts.set(key, theirs);
      }
    }
    if (changed) {
      for (const fn of this.#subscribers) {
        fn();
      }
    }
    return changed;
  }
  toJSON(): JSONGCounter {
    return {
      '@@crdt': G_COUNTER_JSON_IDENTIFIER,
      counts: Object.fromEntries(this.#counts.entries()),
      id: this.#id
    };
  }
}
