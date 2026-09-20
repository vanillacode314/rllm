import { afterEach, describe, expect, it, vi } from 'vitest';

import { LWWValue } from './lww-value.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('set', () => {
  it('sets value', () => {
    const value = new LWWValue(1);
    value.set(2);
    expect(value.get()).toBe(2);
  });
});

describe('update', () => {
  it('updates value', () => {
    const value = new LWWValue(2);
    value.update((value) => value * 5);
    expect(value.get()).toBe(10);
  });
});

describe('json', () => {
  it('survives JSON round trip', () => {
    const value = new LWWValue(1);
    const restored = LWWValue.fromJSON(value.toJSON());
    expect(restored.get()).toBe(1);
  });
  it('restores timestamp so a newer write still wins after round trip', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const restored = LWWValue.fromJSON(older.toJSON());
    restored.receive(newer.toJSON());
    expect(restored.get()).toBe(3);
  });
  it('restores timestamp so an older write still loses after round trip', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const restored = LWWValue.fromJSON(newer.toJSON());
    restored.receive(older.toJSON());
    expect(restored.get()).toBe(3);
  });
  it('rejects payloads that are not lww values', () => {
    expect(() => LWWValue.fromJSON(null)).toThrow();
    expect(() => LWWValue.fromJSON({})).toThrow();
    expect(() => LWWValue.fromJSON({ '@@crdt': 'g-counter' })).toThrow();
  });
  it('rejects an unparseable timestamp', () => {
    expect(() => LWWValue.fromJSON({ ...new LWWValue(1).toJSON(), timestamp: 'nope' })).toThrow();
  });
});

describe('isJsonLWWValue', () => {
  it('accepts a serialized value', () => {
    expect(LWWValue.isJsonLWWValue(new LWWValue(1).toJSON())).toBe(true);
  });
  it('rejects non-objects and foreign payloads', () => {
    expect(LWWValue.isJsonLWWValue(null)).toBe(false);
    expect(LWWValue.isJsonLWWValue(1)).toBe(false);
    expect(LWWValue.isJsonLWWValue('lww-value')).toBe(false);
    expect(LWWValue.isJsonLWWValue({})).toBe(false);
    expect(LWWValue.isJsonLWWValue({ '@@crdt': 'g-counter' })).toBe(false);
  });
});

describe('receive', () => {
  it('overwrites when other is newer', () => {
    const replica1 = new LWWValue(1);
    const replica2 = new LWWValue(2);
    replica2.set(3);
    replica1.receive(replica2.toJSON());
    expect(replica1.get()).toBe(3);
  });
  it('preserves when other is older', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1);
    const replica1 = new LWWValue(1);
    const replica2 = new LWWValue(2);
    vi.setSystemTime(2);
    replica1.set(3);
    replica1.receive(replica2.toJSON());
    expect(replica1.get()).toBe(3);
  });
  it('lets other win on equal timestamps', () => {
    const json = new LWWValue(1).toJSON();
    const replica1 = LWWValue.fromJSON({ ...json, value: 1 });
    const replica2 = LWWValue.fromJSON({ ...json, value: 2 });
    replica1.receive(replica2.toJSON());
    expect(replica1.get()).toBe(2);
  });
  it('is idempotent', () => {
    const replica1 = new LWWValue(1);
    const replica2 = new LWWValue(2);
    replica2.set(3);
    replica1.receive(replica2.toJSON());
    const once = replica1.toJSON();
    replica1.receive(replica2.toJSON());
    expect(replica1.toJSON()).toStrictEqual(once);
  });
  it('reports whether the other replica was applied', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const stale = older.toJSON();
    expect(older.receive(newer.toJSON())).toBe(true);
    expect(older.receive(stale)).toBe(false);
  });
  it('keeps its own id when a replica with a different id arrives', () => {
    const replica1 = new LWWValue(1, { id: 'a' });
    const replica2 = new LWWValue(2, { id: 'b' });
    replica2.set(3);
    replica1.receive(replica2.toJSON());
    expect(replica1.get()).toBe(3);
    expect(replica1.toJSON().id).toBe('a');
  });
});

describe('mergeJSON', () => {
  it('applies the newer payload to the first one', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const replica1 = older.toJSON();
    expect(LWWValue.mergeJSON(replica1, newer.toJSON())).toBe(true);
    expect(replica1.value).toBe(3);
  });
  it('returns false and leaves the first payload untouched when it is newer', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const replica1 = newer.toJSON();
    const snapshot = structuredClone(replica1);
    expect(LWWValue.mergeJSON(replica1, older.toJSON())).toBe(false);
    expect(replica1).toStrictEqual(snapshot);
  });
  it('does not mutate the second payload', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const json = newer.toJSON();
    const snapshot = structuredClone(json);
    LWWValue.mergeJSON(older.toJSON(), json);
    expect(json).toStrictEqual(snapshot);
  });
  it('keeps the first payload id', () => {
    const older = new LWWValue(1, { id: 'older' });
    const newer = new LWWValue(2, { id: 'newer' });
    newer.set(3);
    const replica1 = older.toJSON();
    LWWValue.mergeJSON(replica1, newer.toJSON());
    expect(replica1.value).toBe(3);
    expect(replica1.id).toBe('older');
  });
});
