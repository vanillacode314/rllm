import { afterEach, describe, expect, it, vi } from 'vitest';

import { GCounter, type JSONGCounter } from './crdts/g-counter.ts';
import { JsonCRDT, type PlainJsonCRDT } from './index.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('update', () => {
  describe('top level', () => {
    it('sets existing key', () => {
      const value = new JsonCRDT({ John: 1 });
      value.update((draft) => {
        draft.John = 2;
      });
      expect(value.get()).toStrictEqual({ John: 2 });
    });
    it('sets missing key', () => {
      const value = new JsonCRDT<Partial<{ Jane: number; John: number }>>({ John: 1 });
      value.update((draft) => {
        draft.Jane = 2;
      });
      expect(value.get()).toStrictEqual({ Jane: 2, John: 1 });
    });
    it('wraps objects in json crdt', () => {
      const value = new JsonCRDT<any>({ John: 1 });
      value.update((draft) => {
        draft.Jane = { age: 1 };
        draft.Jane.age = 2;
      });
      expect(value.get()).toStrictEqual({ Jane: { age: 2 }, John: 1 });
    });
    it('deletes key', () => {
      const value = new JsonCRDT<Partial<{ Jane: number; John: number }>>({ John: 1 });
      value.update((draft) => {
        delete draft.John;
      });
      expect(value.get()).toStrictEqual({});
    });
  });
  describe('non-plain values', () => {
    it('keeps class instances from the initial value as-is', () => {
      const at = new Date(0);
      const value = new JsonCRDT({ at });
      expect(value.get().at).toBe(at);
    });
    it('stores class instances assigned through update as-is', () => {
      class Point {
        constructor(
          public x: number,
          public y: number
        ) {}
      }
      const point = new Point(1, 2);
      const value = new JsonCRDT<{ point?: Point }>({});
      value.update((draft) => {
        draft.point = point;
      });
      expect(value.get().point).toBe(point);
    });
    it('wraps null-prototype objects as child crdts', () => {
      const value = new JsonCRDT<{ bag: Record<string, number> }>({ bag: Object.create(null) });
      value.update((draft) => {
        draft.bag.n = 1;
      });
      expect(value.get().bag).toStrictEqual({ n: 1 });
    });
    it('exposes non-plain values on the draft as-is', () => {
      const at = new Date(0);
      const value = new JsonCRDT({ at });
      value.update((draft) => {
        expect(draft.at).toBe(at);
        expect(draft.at.getTime()).toBe(0);
      });
      expect(value.get().at).toBe(at);
    });
  });
  describe('nested', () => {
    it('sets nested key', () => {
      const value = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
      value.update((draft) => {
        draft.job.company = 'Google';
      });
      expect(value.get()).toStrictEqual({ job: { company: 'Google', title: 'Developer' } });
    });
    it('adds nested object', () => {
      const value = new JsonCRDT<{ job: { address?: { city: string } } }>({ job: {} });
      value.update((draft) => {
        draft.job.address = { city: 'NYC' };
      });
      expect(value.get()).toStrictEqual({ job: { address: { city: 'NYC' } } });
    });
    it('wraps objects in json crdt', () => {
      const value = new JsonCRDT<any>({ John: 1 });
      value.update((draft) => {
        draft.Jane = { age: 1 };
        draft.Jane.age = { a: 1 };
        draft.Jane.age.a = 2;
      });
      expect(value.get()).toStrictEqual({ Jane: { age: { a: 2 } }, John: 1 });
    });
    it('deletes nested key', () => {
      const value = new JsonCRDT<{ job: { company: string; title?: string } }>({
        job: { company: 'Acme Inc', title: 'Developer' }
      });
      value.update((draft) => {
        delete draft.job.title;
      });
      expect(value.get()).toStrictEqual({ job: { company: 'Acme Inc' } });
    });
  });
  describe('array', () => {
    it('appends item', () => {
      const value = new JsonCRDT({ list: [1, 2, 3] });
      value.update((draft) => {
        draft.list.push(4);
      });
      expect(value.get()).toStrictEqual({ list: [1, 2, 3, 4] });
    });
    it('removes item', () => {
      const value = new JsonCRDT({ list: [1, 2, 3] });
      value.update((draft) => {
        draft.list.splice(1, 1);
      });
      expect(value.get()).toStrictEqual({ list: [1, 3] });
    });
    it('replaces item', () => {
      const value = new JsonCRDT({ list: [1, 2, 3] });
      value.update((draft) => {
        draft.list[0] = 9;
      });
      expect(value.get()).toStrictEqual({ list: [9, 2, 3] });
    });
    it('propagates array writes through receive', () => {
      const replica1 = new JsonCRDT({ list: [1, 2, 3] });
      const replica2 = JsonCRDT.fromJSON<{ list: number[] }>(
        JSON.parse(JSON.stringify(replica1.toJSON()))
      );
      replica2.update((draft) => {
        draft.list.push(4);
      });
      replica1.merge(replica2.toJSON());
      expect(replica1.get()).toStrictEqual({ list: [1, 2, 3, 4] });
    });
    it('updates a nested array without leaking a top-level key', () => {
      const value = new JsonCRDT<{ job: { list: number[] } }>({ job: { list: [1, 2, 3] } });
      value.update((draft) => {
        draft.job.list.push(4);
      });
      expect(value.get()).toStrictEqual({ job: { list: [1, 2, 3, 4] } });
    });
    it('updates an array nested inside an array', () => {
      const value = new JsonCRDT({
        matrix: [
          [1, 2],
          [3, 4]
        ]
      });
      value.update((draft) => {
        draft.matrix[0]!.push(5);
      });
      expect(value.get()).toStrictEqual({
        matrix: [
          [1, 2, 5],
          [3, 4]
        ]
      });
    });
    it('keeps a later local array write when merging', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1_000_000);
      const replica1 = new JsonCRDT({ list: [1, 2, 3] });
      const replica2 = new JsonCRDT({ list: [1, 2, 3] });
      vi.setSystemTime(1_000_001);
      replica2.update((draft) => {
        draft.list.push(4);
      });
      vi.setSystemTime(1_000_002);
      replica1.update((draft) => {
        draft.list.push(9);
      });
      replica1.merge(replica2.toJSON());
      expect(replica1.get()).toStrictEqual({ list: [1, 2, 3, 9] });
    });
    it('does not share array state between replicas after receive', () => {
      const replica1 = new JsonCRDT({ list: [1, 2, 3] });
      const replica2 = JsonCRDT.fromJSON<{ list: number[] }>(
        JSON.parse(JSON.stringify(replica1.toJSON()))
      );
      replica2.update((draft) => {
        draft.list.push(4);
      });
      replica1.merge(replica2.toJSON());
      replica1.update((draft) => {
        draft.list.push(5);
      });
      expect(replica1.get()).toStrictEqual({ list: [1, 2, 3, 4, 5] });
      expect(replica2.get()).toStrictEqual({ list: [1, 2, 3, 4] });
    });
  });
});

describe('json', () => {
  it('survives JSON round trip', () => {
    const replica1 = new JsonCRDT({ John: 1 });
    const replica2 = JsonCRDT.fromJSON(JSON.parse(JSON.stringify(replica1.toJSON())));
    expect(replica2.get()).toStrictEqual({ John: 1 });
  });
  it('survives nested JSON round trip', () => {
    const replica1 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
    const replica2 = JsonCRDT.fromJSON(JSON.parse(JSON.stringify(replica1.toJSON())));
    expect(replica2.get()).toStrictEqual({ job: { company: 'Acme Inc', title: 'Developer' } });
  });
  it('rejects payloads that are not json crdts', () => {
    expect(() => JsonCRDT.fromJSON({} as never)).toThrow();
    expect(() => JsonCRDT.fromJSON({ '@@crdt': 'lww-map' } as never)).toThrow();
  });
});

describe('isPlainJsonCRDT', () => {
  it('accepts a serialized crdt', () => {
    expect(JsonCRDT.isPlainJsonCRDT(new JsonCRDT({ John: 1 }).toJSON())).toBe(true);
  });
  it('rejects non-objects and foreign payloads', () => {
    expect(JsonCRDT.isPlainJsonCRDT(null)).toBe(false);
    expect(JsonCRDT.isPlainJsonCRDT(1)).toBe(false);
    expect(JsonCRDT.isPlainJsonCRDT('json')).toBe(false);
    expect(JsonCRDT.isPlainJsonCRDT({})).toBe(false);
    expect(JsonCRDT.isPlainJsonCRDT({ '@@crdt': 'lww-map' })).toBe(false);
  });
});

describe('receive', () => {
  describe('top level', () => {
    describe('update', () => {
      it('overwrites when other is newer', () => {
        const replica1 = new JsonCRDT({ John: 1 });
        const replica2 = new JsonCRDT({ John: 1 });
        replica2.update((draft) => {
          draft.John = 2;
        });
        replica1.merge(replica2.toJSON());
        expect(replica1.get()).toStrictEqual({ John: 2 });
      });
      it('preserves when other is older', () => {
        const replica1 = new JsonCRDT({ John: 1 });
        const replica2 = new JsonCRDT({ John: 1 });
        replica2.update((draft) => {
          draft.John = 2;
        });
        replica2.merge(replica1.toJSON());
        expect(replica2.get()).toStrictEqual({ John: 2 });
      });
    });
    describe('delete', () => {
      it('removes when other deleted after us', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1);
        const replica1 = new JsonCRDT<{ John?: number }>({ John: 1 }, { id: 'a' });
        const replica2 = new JsonCRDT<{ John?: number }>({ John: 1 }, { id: 'b' });
        vi.setSystemTime(2);
        replica2.update((draft) => {
          delete draft.John;
        });
        replica1.merge(replica2.toJSON());
        expect(replica1.get()).toStrictEqual({});
      });
      it('removes when the receive lands after the remote delete', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1);
        const replica1 = new JsonCRDT<{ John?: number }>({ John: 1 }, { id: 'a' });
        const replica2 = new JsonCRDT<{ John?: number }>({ John: 1 }, { id: 'b' });
        vi.setSystemTime(2);
        replica2.update((draft) => {
          delete draft.John;
        });
        vi.setSystemTime(3);
        replica1.merge(replica2.toJSON());
        expect(replica1.get()).toStrictEqual({});
      });
      it('preserves when other deleted before us', () => {
        vi.useFakeTimers();
        vi.setSystemTime(1);
        const replica1 = new JsonCRDT<{ John?: number }>({ John: 1 });
        const replica2 = new JsonCRDT<{ John?: number }>({ John: 1 });
        vi.setSystemTime(2);
        replica2.update((draft) => {
          delete draft.John;
        });
        vi.setSystemTime(3);
        replica1.update((draft) => {
          draft.John = 2;
        });
        replica1.merge(replica2.toJSON());
        expect(replica1.get()).toStrictEqual({ John: 2 });
      });
    });
    it('keeps its own id and stamps new children with it', () => {
      const counter = new GCounter({ id: 'remote-counter' });
      counter.increment(2);
      const replica1 = new JsonCRDT({}, { id: 'local' });
      const replica2 = new JsonCRDT(
        { clicks: counter, job: { company: 'Acme Inc' } },
        { id: 'remote' }
      );
      replica1.merge(replica2.toJSON());
      const payload = replica1.toJSON();
      expect(payload.id).toBe('local');
      expect(payload.map.id).toBe('local');
      expect((payload.map.map.job as PlainJsonCRDT).id).toBe('local');
      expect((payload.map.map.clicks as JSONGCounter).id).toBe('local');
    });
  });
  describe('nested', () => {
    describe('update', () => {
      it('overwrites when other is newer', () => {
        const replica1 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
        const replica2 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
        replica2.update((draft) => {
          draft.job.company = 'Google';
        });
        replica1.merge(replica2.toJSON());
        expect(replica1.get()).toStrictEqual({
          job: { company: 'Google', title: 'Developer' }
        });
      });
      it('preserves when other is older', () => {
        const replica1 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
        const replica2 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
        replica2.update((draft) => {
          draft.job.company = 'Google';
        });
        replica2.merge(replica1.toJSON());
        expect(replica2.get()).toStrictEqual({
          job: { company: 'Google', title: 'Developer' }
        });
      });
    });
    it('adds key present only in other', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1);
      const replica1 = new JsonCRDT<{ job: { company: string; title?: string } }>({
        job: { company: 'Acme Inc' }
      });
      const replica2 = new JsonCRDT<{ job: { company: string; title?: string } }>({
        job: { company: 'Acme Inc' }
      });
      replica2.update((draft) => {
        draft.job.title = 'Developer';
      });
      replica1.merge(replica2.toJSON());
      expect(replica1.get()).toStrictEqual({ job: { company: 'Acme Inc', title: 'Developer' } });
    });
    it('is idempotent', () => {
      const replica1 = new JsonCRDT({ John: 1 });
      const replica2 = new JsonCRDT({ Jane: 3, John: 2 });
      replica1.merge(replica2.toJSON());
      const once = replica1.toJSON();
      replica1.merge(replica2.toJSON());
      expect(replica1.toJSON()).toStrictEqual(once);
    });
  });
});

describe('mergeJSON', () => {
  it('merges a newer value into the first payload', () => {
    const replica1 = new JsonCRDT({ John: 1 }).toJSON();
    const replica2 = new JsonCRDT({ John: 1 });
    replica2.update((draft) => {
      draft.John = 2;
    });
    expect(JsonCRDT.mergeJSON(replica1, replica2.toJSON())).toBe(true);
    expect(JsonCRDT.fromJSON(replica1).get()).toStrictEqual({ John: 2 });
  });
  it('returns false and leaves the first payload untouched when the second is older', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1);
    const replica1 = new JsonCRDT({ John: 1 });
    const replica2 = new JsonCRDT({ John: 1 });
    vi.setSystemTime(2);
    replica1.update((draft) => {
      draft.John = 2;
    });
    const json = replica1.toJSON();
    const snapshot = structuredClone(json);
    expect(JsonCRDT.mergeJSON(json, replica2.toJSON())).toBe(false);
    expect(json).toStrictEqual(snapshot);
  });
  it('merges nested crdt payloads recursively', () => {
    const replica1 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } }).toJSON();
    const replica2 = new JsonCRDT({ job: { company: 'Acme Inc', title: 'Developer' } });
    replica2.update((draft) => {
      draft.job.company = 'Google';
    });
    JsonCRDT.mergeJSON(replica1, replica2.toJSON());
    expect(JsonCRDT.fromJSON(replica1).get()).toStrictEqual({
      job: { company: 'Google', title: 'Developer' }
    });
  });
  it('does not alias merged arrays to the source payload', () => {
    const replica1 = new JsonCRDT({ list: [1] }).toJSON();
    const replica2 = new JsonCRDT({ list: [1] });
    replica2.update((draft) => {
      draft.list.push(2);
    });
    const source = replica2.toJSON();
    JsonCRDT.mergeJSON(replica1, source);
    expect(replica1.map.map.list).toStrictEqual([1, 2]);
    expect(replica1.map.map.list).not.toBe(source.map.map.list);
  });
  it('merges counters nested in payloads', () => {
    const local = new GCounter({ id: 'a' });
    local.increment(1);
    const remote = new GCounter({ id: 'b' });
    remote.increment(2);
    const payload1 = new JsonCRDT({ clicks: local }, { id: 'a' }).toJSON();
    const payload2 = new JsonCRDT({ clicks: remote }, { id: 'b' }).toJSON();
    expect(JsonCRDT.mergeJSON(payload1, payload2)).toBe(true);
    expect(payload1.map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { a: 1, b: 2 },
      id: 'a'
    });
  });
  it('keeps the first payload id and stamps new children with it', () => {
    const counter = new GCounter({ id: 'remote-counter' });
    counter.increment(2);
    const payload1 = new JsonCRDT({}, { id: 'target' }).toJSON();
    const payload2 = new JsonCRDT(
      { clicks: counter, job: { company: 'Acme Inc' } },
      { id: 'source' }
    ).toJSON();
    JsonCRDT.mergeJSON(payload1, payload2);
    expect(payload1.id).toBe('target');
    expect(payload1.map.id).toBe('target');
    expect((payload1.map.map.job as PlainJsonCRDT).id).toBe('target');
    expect((payload1.map.map.clicks as JSONGCounter).id).toBe('target');
  });
});

describe('g-counter', () => {
  it('serializes a counter value as a g-counter payload', () => {
    const value = new JsonCRDT({ clicks: new GCounter({ id: 'b' }) });
    expect(value.toJSON().map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { b: 0 },
      id: 'b'
    });
  });
  it('serializes a counter assigned through update', () => {
    const counter = new GCounter({ id: 'b' });
    counter.increment(2);
    const value = new JsonCRDT<{ clicks?: GCounter }>({});
    value.update((draft) => {
      draft.clicks = counter;
    });
    expect(value.toJSON().map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { b: 2 },
      id: 'b'
    });
  });
  it('propagates a counter assigned through update', () => {
    const local = new GCounter({ id: 'a' });
    const remote = new GCounter({ id: 'b' });
    remote.increment(1);
    const replica1 = new JsonCRDT({ clicks: local }, { id: 'a' });
    const replica2 = new JsonCRDT({ clicks: remote }, { id: 'b' });
    const next = new GCounter({ id: 'a' });
    next.increment(2);
    replica1.update((draft) => {
      draft.clicks = next;
    });
    replica2.merge(replica1.toJSON());
    replica1.merge(replica2.toJSON());
    expect(replica1.get().clicks.get()).toBe(3);
    expect(replica2.get().clicks.get()).toBe(3);
    expect(replica2.toJSON().map.map.clicks.counts).toStrictEqual({ a: 2, b: 1 });
  });
  it('propagates a counter incremented through update', () => {
    const local = new GCounter({ id: 'a' });
    const remote = new GCounter({ id: 'b' });
    remote.increment(1);
    const replica1 = new JsonCRDT({ clicks: local }, { id: 'a' });
    const replica2 = new JsonCRDT({ clicks: remote }, { id: 'b' });
    replica1.update((draft) => {
      draft.clicks.increment(2);
    });
    replica2.merge(replica1.toJSON());
    replica1.merge(replica2.toJSON());
    expect(replica1.get().clicks.get()).toBe(3);
    expect(replica2.get().clicks.get()).toBe(3);
    expect(replica2.toJSON().map.map.clicks.counts).toStrictEqual({ a: 2, b: 1 });
  });
  it('converges after replicas exchange counters', () => {
    const local = new GCounter({ id: 'a' });
    local.increment(2);
    const remote = new GCounter({ id: 'b' });
    remote.increment(3);
    const replica1 = new JsonCRDT({ clicks: local }, { id: 'a' });
    const replica2 = new JsonCRDT({ clicks: remote }, { id: 'b' });
    replica1.merge(replica2.toJSON());
    replica2.merge(replica1.toJSON());
    expect(replica1.toJSON().map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { a: 2, b: 3 },
      id: 'a'
    });
    expect(replica2.toJSON().map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { a: 2, b: 3 },
      id: 'b'
    });
  });
  it('replaces a plain value with a counter', () => {
    const remote = new GCounter({ id: 'b' });
    remote.increment(4);
    const replica1 = new JsonCRDT({ clicks: 0 }, { id: 'a' });
    replica1.merge(new JsonCRDT({ clicks: remote }, { id: 'b' }).toJSON());
    expect(replica1.toJSON().map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { a: 0, b: 4 },
      id: 'a'
    });
  });
  it('keeps the higher count when a stale counter arrives', () => {
    const current = new GCounter({ id: 'r' });
    current.increment(5);
    const stale = new GCounter({ id: 'r' });
    stale.increment(2);
    const replica1 = new JsonCRDT({ clicks: current }, { id: 'a' });
    replica1.merge(new JsonCRDT({ clicks: stale }, { id: 'b' }).toJSON());
    expect(replica1.toJSON().map.map.clicks).toStrictEqual({
      '@@crdt': 'g-counter',
      counts: { r: 5 },
      id: 'r'
    });
  });
  it('exposes the counter instance from get', () => {
    const counter = new GCounter({ id: 'b' });
    counter.increment(7);
    const value = new JsonCRDT({ clicks: counter }, { id: 'a' });
    expect(value.get().clicks).toBe(counter);
    expect(value.get().clicks.get()).toBe(7);
  });
  it('restores counters across a JSON round trip', () => {
    const counter = new GCounter({ id: 'b' });
    counter.increment(7);
    const payload = JSON.parse(
      JSON.stringify(new JsonCRDT({ clicks: counter }, { id: 'a' }).toJSON())
    );
    const restored = JsonCRDT.fromJSON<{ clicks: GCounter }>(payload);
    expect(restored.get().clicks).toBeInstanceOf(GCounter);
    expect(restored.get().clicks.get()).toBe(7);
    const remote = new GCounter({ id: 'c' });
    remote.increment(1);
    restored.merge(new JsonCRDT({ clicks: remote }, { id: 'c' }).toJSON());
    expect(restored.get().clicks.get()).toBe(8);
  });
});
