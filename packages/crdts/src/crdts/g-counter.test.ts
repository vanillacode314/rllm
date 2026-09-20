import { describe, expect, it } from 'vitest';

import { GCounter } from './g-counter.ts';

describe('increment', () => {
  it('increments by one by default', () => {
    const counter = new GCounter();
    counter.increment();
    expect(counter.get()).toBe(1);
  });
  it('increments by n', () => {
    const counter = new GCounter();
    counter.increment(5);
    expect(counter.get()).toBe(5);
  });
  it('accumulates across calls', () => {
    const counter = new GCounter();
    counter.increment();
    counter.increment(2);
    counter.increment(3);
    expect(counter.get()).toBe(6);
  });
  it('increments from zero when restored counts lack its own id', () => {
    const counter = new GCounter({ counts: new Map([['a', 1]]), id: 'b' });
    counter.increment();
    expect(counter.get()).toBe(2);
    expect(counter.toJSON().counts).toStrictEqual({ a: 1, b: 1 });
  });
});

describe('get', () => {
  it('is zero initially', () => {
    expect(new GCounter().get()).toBe(0);
  });
  it('sums the counts of every replica', () => {
    const counter = GCounter.fromJSON({
      '@@crdt': 'g-counter',
      counts: { a: 1, b: 2, c: 3 },
      id: 'a'
    });
    expect(counter.get()).toBe(6);
  });
});

describe('json', () => {
  it('survives JSON round trip', () => {
    const counter = new GCounter();
    counter.increment(3);
    const restored = GCounter.fromJSON(counter.toJSON());
    expect(restored.get()).toBe(3);
  });
  it('preserves the replica id so increments after a round trip count once', () => {
    const counter = new GCounter();
    counter.increment(2);
    const restored = GCounter.fromJSON(counter.toJSON());
    restored.increment(1);
    expect(restored.get()).toBe(3);
    expect(restored.toJSON().counts).toStrictEqual({ [counter.toJSON().id]: 3 });
  });
  it('does not mutate the JSON it is given', () => {
    const json = new GCounter().toJSON();
    const snapshot = structuredClone(json);
    const counter = GCounter.fromJSON(json);
    counter.increment();
    expect(json).toStrictEqual(snapshot);
  });
  it('rejects payloads that are not counters', () => {
    expect(() => GCounter.fromJSON(null)).toThrow();
    expect(() => GCounter.fromJSON({})).toThrow();
    expect(() => GCounter.fromJSON({ '@@crdt': 'lww-value' })).toThrow();
  });
  it('drops counts that are not integers', () => {
    const counter = GCounter.fromJSON({
      '@@crdt': 'g-counter',
      counts: { a: 1, b: 2.5 },
      id: 'a'
    });
    expect(counter.get()).toBe(1);
    expect(counter.toJSON().counts).toStrictEqual({ a: 1 });
  });
});

describe('isJsonGCounter', () => {
  it('accepts a serialized counter', () => {
    expect(GCounter.isJsonGCounter(new GCounter().toJSON())).toBe(true);
  });
  it('rejects non-objects and foreign payloads', () => {
    expect(GCounter.isJsonGCounter(null)).toBe(false);
    expect(GCounter.isJsonGCounter(1)).toBe(false);
    expect(GCounter.isJsonGCounter('g-counter')).toBe(false);
    expect(GCounter.isJsonGCounter({})).toBe(false);
    expect(GCounter.isJsonGCounter({ '@@crdt': 'lww-value' })).toBe(false);
  });
});

describe('receive', () => {
  it('merges a higher count from another replica', () => {
    const counter = new GCounter({ id: 'a' });
    const other = new GCounter({ id: 'b' });
    other.increment(4);
    expect(counter.receive(other.toJSON())).toBe(true);
    expect(counter.get()).toBe(4);
  });
  it('ignores a lower count from another replica', () => {
    const counter = new GCounter({ id: 'a' });
    const other = new GCounter({ id: 'a' });
    counter.increment(4);
    other.increment(1);
    expect(counter.receive(other.toJSON())).toBe(false);
    expect(counter.get()).toBe(4);
  });
  it('adds a replica seen for the first time', () => {
    const counter = new GCounter({ id: 'a' });
    const other = new GCounter({ id: 'b' });
    other.increment(2);
    counter.receive(other.toJSON());
    expect(counter.get()).toBe(2);
  });
  it('is idempotent', () => {
    const counter = new GCounter({ id: 'a' });
    const other = new GCounter({ id: 'b' });
    other.increment(2);
    counter.receive(other.toJSON());
    const once = counter.toJSON();
    expect(counter.receive(other.toJSON())).toBe(false);
    expect(counter.toJSON()).toStrictEqual(once);
  });
  it('does not mutate the payload it receives', () => {
    const counter = new GCounter({ id: 'a' });
    const other = new GCounter({ id: 'b' });
    other.increment(2);
    const json = other.toJSON();
    const snapshot = structuredClone(json);
    counter.receive(json);
    expect(json).toStrictEqual(snapshot);
  });
  it('ignores counts that are not integers', () => {
    const counter = new GCounter({ id: 'a' });
    expect(counter.receive({ '@@crdt': 'g-counter', counts: { b: 2.5 }, id: 'b' })).toBe(false);
    expect(counter.get()).toBe(0);
  });
  it('keeps its own id when a replica with a different id arrives', () => {
    const counter = new GCounter({ id: 'a' });
    const other = new GCounter({ id: 'b' });
    other.increment(4);
    counter.receive(other.toJSON());
    expect(counter.get()).toBe(4);
    expect(counter.toJSON().id).toBe('a');
  });
  it('converges when both replicas increment concurrently', () => {
    const replica1 = new GCounter({ id: 'a' });
    const replica2 = new GCounter({ id: 'b' });
    replica1.increment();
    replica2.increment(2);
    replica1.receive(replica2.toJSON());
    replica2.receive(replica1.toJSON());
    expect(replica1.get()).toBe(3);
    expect(replica2.get()).toBe(3);
  });
});

describe('mergeJSON', () => {
  it('merges a higher count into the first payload', () => {
    const replica1 = new GCounter({ id: 'a' }).toJSON();
    const replica2 = new GCounter({ id: 'a' });
    replica2.increment(3);
    expect(GCounter.mergeJSON(replica1, replica2.toJSON())).toBe(true);
    expect(replica1.counts).toStrictEqual({ a: 3 });
  });
  it('returns false when nothing changes', () => {
    const replica1 = new GCounter({ id: 'a' });
    const replica2 = new GCounter({ id: 'a' });
    replica1.increment(3);
    const json = replica1.toJSON();
    const snapshot = structuredClone(json);
    expect(GCounter.mergeJSON(json, replica2.toJSON())).toBe(false);
    expect(json).toStrictEqual(snapshot);
  });
  it('adds replicas missing from the first payload', () => {
    const replica1 = new GCounter({ id: 'a' }).toJSON();
    const replica2 = new GCounter({ id: 'b' });
    replica2.increment(2);
    GCounter.mergeJSON(replica1, replica2.toJSON());
    expect(GCounter.fromJSON(replica1).get()).toBe(2);
  });
  it('does not mutate the second payload', () => {
    const replica1 = new GCounter({ id: 'a' }).toJSON();
    const replica2 = new GCounter({ id: 'a' });
    replica2.increment(2);
    const json = replica2.toJSON();
    const snapshot = structuredClone(json);
    GCounter.mergeJSON(replica1, json);
    expect(json).toStrictEqual(snapshot);
  });
  it('ignores counts that are not integers', () => {
    const replica1 = new GCounter({ id: 'a' }).toJSON();
    expect(
      GCounter.mergeJSON(replica1, { '@@crdt': 'g-counter', counts: { b: 2.5 }, id: 'b' })
    ).toBe(false);
    expect(replica1.counts).toStrictEqual({ a: 0 });
  });
  it('keeps the first payload id', () => {
    const replica1 = new GCounter({ id: 'target' }).toJSON();
    const replica2 = new GCounter({ id: 'source' });
    replica2.increment(4);
    GCounter.mergeJSON(replica1, replica2.toJSON());
    expect(replica1.counts).toStrictEqual({ target: 0, source: 4 });
    expect(replica1.id).toBe('target');
  });
});
