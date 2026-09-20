import { afterEach, describe, expect, it, vi } from 'vitest';

import { LWWMap } from './lww-map.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('set', () => {
  it('sets existing key', () => {
    const value = new LWWMap({ John: 1 });
    value.set('John', 3);
    expect(value.get('John')).toBe(3);
  });
  it('sets missing key', () => {
    const value = new LWWMap({ John: 1 });
    value.set('Jane', 2);
    expect(value.get('Jane')).toBe(2);
  });
});

describe('update', () => {
  it('updates existing key', () => {
    const value = new LWWMap({ John: 1 });
    value.update('John', (v) => v! + 1);
    expect(value.get('John')).toBe(2);
  });
  it('updates missing key', () => {
    const value = new LWWMap({ John: 1 });
    value.update('Jane', (v) => (v ? v + 1 : 1));
    expect(value.get('Jane')).toBe(1);
  });
});

describe('delete', () => {
  it('deletes existing key', () => {
    const value = new LWWMap({ John: 1 });
    value.delete('John');
    expect(value.get('John')).toBeUndefined();
  });
  it('ignores missing key', () => {
    const value = new LWWMap({ John: 1 });
    value.delete('Jane');
    expect(value.get('Jane')).toBeUndefined();
  });
  it('allows re-adding a deleted key', () => {
    const value = new LWWMap({ John: 1 });
    value.delete('John');
    value.set('John', 5);
    expect(value.get('John')).toBe(5);
  });
});

describe('json', () => {
  it('survives JSON round trip', () => {
    const value = new LWWMap({ John: 1 });
    const restored = LWWMap.fromJSON(value.toJSON());
    expect(restored.get('John')).toBe(1);
  });
  it('does not mutate the JSON it is given', () => {
    const value = new LWWMap({ John: 1 });
    const json = value.toJSON();
    const snapshot = structuredClone(json);
    LWWMap.fromJSON(json);
    expect(json).toStrictEqual(snapshot);
  });
  it('preserves tombstones across round trip', () => {
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.delete('Jane');
    const restored = LWWMap.fromJSON(replica1.toJSON());
    restored.receive(replica2.toJSON());
    expect(restored.get('Jane')).toBeUndefined();
  });
  it('rejects payloads that are not lww maps', () => {
    expect(() => LWWMap.fromJSON(null)).toThrow();
    expect(() => LWWMap.fromJSON({})).toThrow();
    expect(() => LWWMap.fromJSON({ '@@crdt': 'lww-value' })).toThrow();
  });
  it('rejects an unparseable timestamp', () => {
    const json = new LWWMap({ Jane: 1 }).toJSON();
    expect(() => LWWMap.fromJSON({ ...json, timestamps: { Jane: ['nope'] } })).toThrow();
  });
});

describe('isJsonLWWMap', () => {
  it('accepts a serialized map', () => {
    expect(LWWMap.isJsonLWWMap(new LWWMap({ Jane: 1 }).toJSON())).toBe(true);
  });
  it('rejects non-objects and foreign payloads', () => {
    expect(LWWMap.isJsonLWWMap(null)).toBe(false);
    expect(LWWMap.isJsonLWWMap(1)).toBe(false);
    expect(LWWMap.isJsonLWWMap('lww-map')).toBe(false);
    expect(LWWMap.isJsonLWWMap({})).toBe(false);
    expect(LWWMap.isJsonLWWMap({ '@@crdt': 'lww-value' })).toBe(false);
  });
});

describe('iteration', () => {
  it('iterates the live keys, values, and entries', () => {
    const value = new LWWMap({ Jane: 1, John: 2 });
    value.delete('John');
    expect([...value.keys()]).toStrictEqual(['Jane']);
    expect([...value.values()]).toStrictEqual([1]);
    expect([...value.entries()]).toStrictEqual([['Jane', 1]]);
  });
});

describe('receive', () => {
  it('overwrites key when other is newer', () => {
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.set('Jane', 2);
    replica1.receive(replica2.toJSON());
    expect(replica1.get('Jane')).toBe(2);
  });
  it('preserves key when other is older', () => {
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.set('Jane', 2);
    replica2.receive(replica1.toJSON());
    expect(replica2.get('Jane')).toBe(2);
  });
  it('adds key present only in other', () => {
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.set('John', 1);
    replica1.receive(replica2.toJSON());
    expect(replica1.get('John')).toBe(1);
  });
  it('removes key when other deleted it after us', () => {
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.delete('Jane');
    replica1.receive(replica2.toJSON());
    expect(replica1.get('Jane')).toBeUndefined();
  });
  it('preserves key when other deleted it before us', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1);
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    vi.setSystemTime(2);
    replica2.delete('Jane');
    vi.setSystemTime(3);
    replica1.set('Jane', 3);
    replica1.receive(replica2.toJSON());
    expect(replica1.get('Jane')).toBe(3);
  });
  it('applies the replacer to conflicting values', () => {
    const replica1 = new LWWMap<number[]>({ list: [1] });
    const replica2 = new LWWMap<number[]>({ list: [1] });
    replica2.set('list', [2]);
    replica1.receive(replica2.toJSON(), (_key, value, current) => [...(current ?? []), ...value]);
    expect(replica1.get('list')).toStrictEqual([1, 2]);
  });
  it('is idempotent', () => {
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 2, John: 3 });
    replica1.receive(replica2.toJSON());
    const once = replica1.toJSON();
    replica1.receive(replica2.toJSON());
    expect(replica1.toJSON().map).toStrictEqual(once.map);
  });
  it('does not mutate the source replica when writing a merged key', () => {
    const source = new LWWMap({ Jane: 1 }, { id: 'source' });
    const target = new LWWMap({}, { id: 'target' });
    target.receive(source.toJSON());
    const before = source.toJSON();
    target.set('Jane', 2);
    expect(source.toJSON()).toStrictEqual(before);
  });
  it('keeps its own id when a replica with a different id arrives', () => {
    const replica1 = new LWWMap({ Jane: 1 }, { id: 'a' });
    const replica2 = new LWWMap({ Jane: 2, John: 3 }, { id: 'b' });
    replica1.receive(replica2.toJSON());
    expect(replica1.get('Jane')).toBe(2);
    expect(replica1.toJSON().id).toBe('a');
  });
});

describe('mergeJSON', () => {
  it('merges a newer key into the first payload', () => {
    const replica1 = new LWWMap({ Jane: 1 }).toJSON();
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.set('Jane', 2);
    expect(LWWMap.mergeJSON(replica1, replica2.toJSON())).toBe(true);
    expect(LWWMap.fromJSON(replica1).get('Jane')).toBe(2);
  });
  it('removes a key the second payload deleted after the first was written', () => {
    const replica1 = new LWWMap({ Jane: 1 }).toJSON();
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.delete('Jane');
    LWWMap.mergeJSON(replica1, replica2.toJSON());
    expect(LWWMap.fromJSON(replica1).get('Jane')).toBeUndefined();
  });
  it('returns false and leaves the first payload untouched when the second is older', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1);
    const replica1 = new LWWMap({ Jane: 1 });
    const replica2 = new LWWMap({ Jane: 1 });
    vi.setSystemTime(2);
    replica1.set('Jane', 2);
    const json = replica1.toJSON();
    const snapshot = structuredClone(json);
    expect(LWWMap.mergeJSON(json, replica2.toJSON())).toBe(false);
    expect(json).toStrictEqual(snapshot);
  });
  it('applies the replacer to conflicting values', () => {
    const replica1 = new LWWMap<number[]>({ list: [1] }).toJSON();
    const replica2 = new LWWMap<number[]>({ list: [1] });
    replica2.set('list', [2]);
    LWWMap.mergeJSON(replica1, replica2.toJSON(), (_key, value, current) => [
      ...(current ?? []),
      ...value
    ]);
    expect(LWWMap.fromJSON(replica1).get('list')).toStrictEqual([1, 2]);
  });
  it('does not mutate the second payload', () => {
    const replica1 = new LWWMap({ Jane: 1 }).toJSON();
    const replica2 = new LWWMap({ Jane: 1 });
    replica2.set('Jane', 2);
    const json = replica2.toJSON();
    const snapshot = structuredClone(json);
    LWWMap.mergeJSON(replica1, json);
    expect(json).toStrictEqual(snapshot);
  });
  it('keeps the first payload id', () => {
    const replica1 = new LWWMap({ Jane: 1 }, { id: 'target' }).toJSON();
    const replica2 = new LWWMap({ John: 3 }, { id: 'source' });
    LWWMap.mergeJSON(replica1, replica2.toJSON());
    expect(LWWMap.fromJSON(replica1).get('John')).toBe(3);
    expect(replica1.id).toBe('target');
  });
});
