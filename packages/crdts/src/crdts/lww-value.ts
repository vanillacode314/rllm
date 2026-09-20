import { HLC, tryParseHLCFromString } from 'hlc';
import { nanoid } from 'nanoid';

import { invariant } from '~/utils';

/** JSON discriminator identifying an {@link LWWValue} payload. */
export const LWW_VALUE_JSON_IDENTIFIER = 'lww-value';

/**
 * Serialized form of an {@link LWWValue}.
 *
 * @typeParam T Type of the stored value.
 */
export type JSONLWWValue<T> = {
  '@@crdt': typeof LWW_VALUE_JSON_IDENTIFIER;
  id: string;
  timestamp: string;
  value: T;
};

/**
 * A last-writer-wins value: one value annotated with a Hybrid Logical
 * Clock (HLC) timestamp. Local writes advance the clock, and merging a
 * replica applies its value only when its timestamp is not older than the
 * local one, so concurrent replicas converge on the newer write regardless
 * of arrival order.
 *
 * @typeParam T Type of the stored value.
 */
export class LWWValue<T> {
  #id: string;
  #timestamp: HLC;
  #value: T;
  /**
   * Creates a lww value holding `value`.
   *
   * @param value Initial value.
   * @param opts.id Replica id used for generated timestamps; random when omitted.
   * @param opts.timestamp Do not use, for internal usage only
   */
  constructor(value: T, opts: { id?: string; timestamp?: HLC } = {}) {
    const { id, timestamp } = opts;
    this.#id = id ?? nanoid();
    this.#timestamp = timestamp ?? HLC.generate(this.#id).increment();
    this.#value = value;
  }
  /**
   * Rebuilds a lww value from a serialized payload.
   *
   * @param json Value previously produced by {@link LWWValue#toJSON}.
   * @returns The restored lww value with its id and timestamp intact.
   * @throws If `json` is not an {@link JSONLWWValue} or its timestamp fails to parse.
   */
  static fromJSON<T>(json: unknown) {
    invariant(this.isJsonLWWValue<T>(json));
    const [hlc] = tryParseHLCFromString(json.timestamp);
    invariant(hlc !== null, `invalid timestamp: ${json.timestamp}`);
    return new LWWValue(json.value, { id: json.id, timestamp: hlc });
  }
  /**
   * Type guard for {@link JSONLWWValue} payloads.
   *
   * @param value Value to test.
   * @returns `true` when `value` carries the LWWValue discriminator.
   */
  static isJsonLWWValue<T>(value: unknown): value is JSONLWWValue<T> {
    return (
      typeof value === 'object' &&
      value !== null &&
      '@@crdt' in value &&
      value['@@crdt'] === LWW_VALUE_JSON_IDENTIFIER
    );
  }
  /**
   * Merges two replicas
   *
   * @param replica1 Replica to merge into.
   * @param replica2 Replica to merge from.
   * @returns `true` when `replica2`'s timestamp was applied; `false` when `replica1` is strictly newer.
   */
  static mergeJSON<T>(replica1: JSONLWWValue<T>, replica2: JSONLWWValue<T>): boolean {
    if (replica1.timestamp > replica2.timestamp) return false;

    const [hlc] = tryParseHLCFromString(replica1.timestamp);
    invariant(hlc !== null, `invalid timestamp: ${replica1.timestamp}`);
    replica1.value = replica2.value;
    replica1.timestamp = hlc.receive(replica2.timestamp).toString();
    return true;
  }
  /** Returns the current value. */
  get() {
    return this.#value;
  }
  /**
   * Merges a replica into this lww value.
   *
   * @param replica Remote payload previously produced by {@link LWWValue#toJSON}.
   * @returns `true` when the replica's timestamp was applied; `false` when this lww value is strictly newer.
   */
  receive(replica: JSONLWWValue<T>): boolean {
    if (this.#timestamp.cmp(replica.timestamp) > 0) return false;

    this.#value = replica.value;
    this.#timestamp = this.#timestamp.receive(replica.timestamp);
    return true;
  }
  /**
   * Stores `value` and advances the local clock so this write wins over
   * earlier writes from this or any older replica state.
   *
   * @param value New value.
   */
  set(value: T) {
    this.#value = value;
    this.#timestamp.increment();
  }
  /**
   * Serializes the lww value, including its id and timestamp so future
   * merges keep their ordering after a round trip.
   *
   * @returns The JSON payload for {@link LWWValue.fromJSON}.
   */
  toJSON(): JSONLWWValue<T> {
    return {
      '@@crdt': LWW_VALUE_JSON_IDENTIFIER,
      id: this.#id,
      timestamp: this.#timestamp.toString(),
      value: this.#value
    };
  }
  /**
   * Replaces the value with `fn(current)`, advancing the clock exactly as
   * {@link LWWValue.set} would.
   *
   * @param fn Producer of the new value from the current one.
   */
  update(fn: (value: T) => T) {
    this.set(fn(this.#value));
  }
}
