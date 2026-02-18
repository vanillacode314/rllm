import { describe, expect, it } from 'vitest';

import { type Hasher, MerkleTree } from '~/index';

describe('MerkleTree', () => {
  describe('constructor', () => {
    it('creates tree with arity 2 and string hasher', () => {
      const hasher = createStringHasher();
      const tree = new MerkleTree(2, hasher);
      expect(tree.arity).toBe(2);
    });

    it('creates tree with custom arity', () => {
      const hasher = createStringHasher();
      const tree = new MerkleTree(4, hasher);
      expect(tree.arity).toBe(4);
    });

    it('throws error when arity is less than 2', () => {
      const hasher = createStringHasher();
      expect(() => new MerkleTree(1, hasher)).toThrow('Arity must be greater than 1');
      expect(() => new MerkleTree(0, hasher)).toThrow('Arity must be greater than 1');
      expect(() => new MerkleTree(-1, hasher)).toThrow('Arity must be greater than 1');
    });
  });

  describe('insert', () => {
    it('inserts first value as root node', () => {
      const hasher = createStringHasher();
      const tree = new MerkleTree(2, hasher);
      tree.insert('hello', 'meta-hello');

      const json = tree.toJSON();
      expect(json.arity).toBe(2);
      expect(json.tree).toBeDefined();
    });

    it('inserts multiple values into binary tree (arity=2)', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');
      tree.insert('c', 'meta-c');

      const json = tree.toJSON();
      expect(json.tree).toBeDefined();
      expect(json.tree?.children).toBeDefined();
    });

    it('inserts multiple values into quaternary tree (arity=4)', () => {
      const tree = new MerkleTree(4, createStringHasher());
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');
      tree.insert('c', 'meta-c');
      tree.insert('d', 'meta-d');

      const json = tree.toJSON();
      expect(json.arity).toBe(4);
      expect(json.tree).toBeDefined();
    });

    it('expands tree depth when node is full (binary tree)', () => {
      const tree = new MerkleTree(2, createStringHasher());

      // Fill first node (arity=2)
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');

      // This should trigger depth expansion
      tree.insert('c', 'meta-c');

      const json = tree.toJSON();
      expect(json.tree).toBeDefined();
    });

    it('handles insert with arbitrary metadata type', () => {
      interface CustomMeta {
        id: number;
        tags: string[];
        timestamp: string;
      }

      const hasher: Hasher<string> = {
        hash: (value: string) => new TextEncoder().encode(value)
      };
      const tree = new MerkleTree<string, CustomMeta>(2, hasher);

      tree.insert('data1', { id: 1, tags: ['tag1', 'tag2'], timestamp: '2024-01-01' });
      tree.insert('data2', { id: 2, tags: ['tag3'], timestamp: '2024-01-02' });

      const json = tree.toJSON();
      expect(json.tree).toBeDefined();
    });

    it('handles binary data hasher', () => {
      const hasher: Hasher<Uint8Array> = {
        hash: (value: Uint8Array) => new Uint8Array(value)
      };
      const tree = new MerkleTree<Uint8Array>(2, hasher);

      const data = new Uint8Array([1, 2, 3, 4]);
      tree.insert(data, 'binary-meta');

      const json = tree.toJSON();
      expect(json.tree).toBeDefined();
    });

    it('inserts many values without error', () => {
      const tree = new MerkleTree(3, createStringHasher());

      for (let i = 0; i < 100; i++) {
        tree.insert(`value-${i}`, `meta-${i}`);
      }

      const json = tree.toJSON();
      expect(json.tree).toBeDefined();
      expect(json.arity).toBe(3);
    });
  });

  describe('toJSON', () => {
    it('returns valid JSON structure', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('test', 'meta-test');

      const json = tree.toJSON();

      expect(json).toHaveProperty('arity');
      expect(json).toHaveProperty('tree');
      expect(typeof json.arity).toBe('number');
      expect(json.tree).toHaveProperty('children');
    });

    it('serializes tree structure correctly', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');

      const json = tree.toJSON();
      expect(json.arity).toBe(2);
      expect(json.tree).not.toBeNull();
    });

    it('serializes empty tree state', () => {
      const tree = new MerkleTree(3, createStringHasher());

      const json = tree.toJSON();

      expect(json.arity).toBe(3);
      expect(json.tree).toBeDefined();
    });
  });

  describe('arity preservation', () => {
    it('maintains arity after multiple insertions', () => {
      const tree = new MerkleTree(4, createStringHasher());

      for (let i = 0; i < 20; i++) {
        tree.insert(`value-${i}`, `meta-${i}`);
      }

      expect(tree.arity).toBe(4);
    });

    it('maintains arity after multiple depth expansions', () => {
      const tree = new MerkleTree(2, createStringHasher());

      for (let i = 0; i < 100; i++) {
        tree.insert(`value-${i}`, `meta-${i}`);
      }

      expect(tree.arity).toBe(2);
    });
  });

  describe('constructor with items (seeding)', () => {
    it('creates tree seeded with single item', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }]);

      expect(tree.arity).toBe(2);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
    });

    it('creates tree seeded with multiple items at same depth', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);

      expect(tree.arity).toBe(2);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
      expect(json.tree?.children.length).toBe(2);
    });

    it('creates tree seeded with items requiring depth expansion', () => {
      const tree = new MerkleTree(2, createStringHasher(), [
        { value: 'a' },
        { value: 'b' },
        { value: 'c' }
      ]);

      expect(tree.arity).toBe(2);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
      expect(json.tree?.children.length).toBe(2);
      expect(json.tree?.children[0]?.children.length).toBe(2);
      expect(json.tree?.children[1]?.children.length).toBe(1);
    });

    it('creates tree seeded with exact arity number of items', () => {
      const tree = new MerkleTree(3, createStringHasher(), [
        { value: 'a' },
        { value: 'b' },
        { value: 'c' }
      ]);

      expect(tree.arity).toBe(3);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
      expect(json.tree?.children.length).toBe(3);
    });

    it('creates tree seeded with items for higher arity', () => {
      const tree = new MerkleTree(4, createStringHasher(), [
        { value: 'a' },
        { value: 'b' },
        { value: 'c' },
        { value: 'd' },
        { value: 'e' }
      ]);

      expect(tree.arity).toBe(4);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
    });

    it('creates tree seeded with large number of items', () => {
      const items = Array.from({ length: 50 }, (_, i) => `value-${i}`);
      const tree = new MerkleTree(
        2,
        createStringHasher(),
        items.map((v) => ({ value: v }))
      );

      expect(tree.arity).toBe(2);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
    });

    it('produces same structure as sequential inserts', () => {
      const items = ['a', 'b', 'c'].map((v) => ({ value: v }));
      const seedTree = new MerkleTree(2, createStringHasher(), items);

      const insertTree = new MerkleTree(2, createStringHasher());
      insertTree.insert('a', undefined as unknown as string);
      insertTree.insert('b', undefined as unknown as string);
      insertTree.insert('c', undefined as unknown as string);

      expect(seedTree.toJSON()).toEqual(insertTree.toJSON());
    });

    it('allows further inserts after seeding', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);
      tree.insert('c', 'meta-c');

      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
    });

    it('creates tree with items and returns null getMeta for seeded items', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);

      // Seeded items have undefined meta (cast from unknown)
      expect(tree.getMeta(0)).toBeNull();
      expect(tree.getMeta(1)).toBeNull();
    });

    it('handles different data types for seeded items', () => {
      const byteHasher: Hasher<Uint8Array> = {
        hash: (value: Uint8Array) => new Uint8Array(value)
      };
      const items = [{ value: new Uint8Array([1, 2]) }, { value: new Uint8Array([3, 4]) }];
      const tree = new MerkleTree(2, byteHasher, items);

      expect(tree.arity).toBe(2);
      const json = tree.toJSON();
      expect(json.tree).not.toBeNull();
    });

    it('seeded items have a valid root digest', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);

      expect(tree.rootDigest()).toBeInstanceOf(Uint8Array);
    });
  });

  describe('getHash', () => {
    it('returns root hash for empty path', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');

      const rootHash = tree.getHash([]);
      expect(rootHash).toBeInstanceOf(Uint8Array);
      expect(rootHash).toEqual(tree.rootDigest());
    });

    it('returns hash of specific child node', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');

      const child0Hash = tree.getHash([0]);
      expect(child0Hash).toBeInstanceOf(Uint8Array);

      const child1Hash = tree.getHash([1]);
      expect(child1Hash).toBeInstanceOf(Uint8Array);
    });

    it('returns hash of nested node', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');
      tree.insert('c', 'meta-c');

      const nestedHash = tree.getHash([0, 0]);
      expect(nestedHash).toBeInstanceOf(Uint8Array);
    });

    it('returns null for non-existent path', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');

      expect(tree.getHash([99])).toBeNull();
      expect(tree.getHash([0, 99])).toBeNull();
    });

    it('returns null for path that goes beyond leaf depth', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');

      // Path exists at depth 0 but not depth 1
      expect(tree.getHash([0, 0])).toBeNull();
    });

    it('throws error when tree is empty', () => {
      const tree = new MerkleTree(2, createStringHasher());

      expect(() => tree.getHash([])).toThrow('Tree is empty');
      expect(() => tree.getHash([0])).toThrow('Tree is empty');
    });

    it('returns different hashes for different leaf values', () => {
      const tree = new MerkleTree(2, createStringHasher());
      tree.insert('a', 'meta-a');
      tree.insert('b', 'meta-b');

      const hash0 = tree.getHash([0]);
      const hash1 = tree.getHash([1]);

      // Different values should produce different digests
      expect(hash0).not.toEqual(hash1);
    });

    it('returns correct hash after seeding with items', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);

      const rootHash = tree.getHash([]);
      const child0Hash = tree.getHash([0]);
      const child1Hash = tree.getHash([1]);

      expect(rootHash).toBeInstanceOf(Uint8Array);
      expect(child0Hash).toBeInstanceOf(Uint8Array);
      expect(child1Hash).toBeInstanceOf(Uint8Array);
      expect(child0Hash).not.toEqual(child1Hash);
    });

    it('returns hash for deeply nested leaf in seeded tree', () => {
      const tree = new MerkleTree(2, createStringHasher(), [
        { value: 'a' },
        { value: 'b' },
        { value: 'c' },
        { value: 'd' }
      ]);

      // Path to each leaf in a depth-2 binary tree
      const leaf0 = tree.getHash([0, 0]);
      const leaf1 = tree.getHash([0, 1]);
      const leaf2 = tree.getHash([1, 0]);
      const leaf3 = tree.getHash([1, 1]);

      expect(leaf0).toBeInstanceOf(Uint8Array);
      expect(leaf1).toBeInstanceOf(Uint8Array);
      expect(leaf2).toBeInstanceOf(Uint8Array);
      expect(leaf3).toBeInstanceOf(Uint8Array);
    });

    it('returns consistent hash for same value across different paths', () => {
      const tree = new MerkleTree(3, createStringHasher());
      tree.insert('x', 'meta-x');
      tree.insert('x', 'meta-x'); // Same value, but different meta — digest based on value only

      const hash0 = tree.getHash([0]);
      const hash1 = tree.getHash([1]);

      // Same value hashed → same digest (hasher ignores meta)
      expect(hash0).toEqual(hash1);
    });

    it('returns hashes consistently regardless of tree shape', () => {
      const tree1 = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);
      const tree2 = new MerkleTree(2, createStringHasher());
      tree2.insert('a', undefined as unknown as string);
      tree2.insert('b', undefined as unknown as string);

      expect(tree1.getHash([])).toEqual(tree2.getHash([]));
      expect(tree1.getHash([0])).toEqual(tree2.getHash([0]));
    });

    it('works after further inserts following seeding', () => {
      const tree = new MerkleTree(2, createStringHasher(), [{ value: 'a' }, { value: 'b' }]);
      tree.insert('c', 'meta-c');

      expect(tree.getHash([])).toBeInstanceOf(Uint8Array);
      expect(tree.getHash([0, 0])).toBeInstanceOf(Uint8Array);
    });
  });
});

function createStringHasher(): Hasher<string> {
  return {
    hash: (value: string) => new TextEncoder().encode(value)
  };
}

describe('getMeta', () => {
  it('returns meta for item inserted at index 0', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'meta-a');

    expect(tree.getMeta(0)).toBe('meta-a');
  });

  it('returns meta for items inserted at sequential indices', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'meta-a');
    tree.insert('b', 'meta-b');
    tree.insert('c', 'meta-c');

    expect(tree.getMeta(0)).toBe('meta-a');
    expect(tree.getMeta(1)).toBe('meta-b');
    expect(tree.getMeta(2)).toBe('meta-c');
  });

  it('returns meta for all leaves in quaternary tree', () => {
    const tree = new MerkleTree(4, createStringHasher());
    tree.insert('a', 'm0');
    tree.insert('b', 'm1');
    tree.insert('c', 'm2');
    tree.insert('d', 'm3');

    expect(tree.getMeta(0)).toBe('m0');
    expect(tree.getMeta(1)).toBe('m1');
    expect(tree.getMeta(2)).toBe('m2');
    expect(tree.getMeta(3)).toBe('m3');
  });

  it('returns meta for deeply nested leaf after multiple depth expansions', () => {
    const tree = new MerkleTree(2, createStringHasher());
    const metas = Array.from({ length: 10 }, (_, i) => `meta-${i}`);
    for (let i = 0; i < 10; i++) {
      tree.insert(`value-${i}`, metas[i]!);
    }

    for (let i = 0; i < 10; i++) {
      expect(tree.getMeta(i)).toBe(metas[i]);
    }
  });

  it('returns meta with complex object metadata type', () => {
    interface ComplexMeta {
      id: number;
      tags: string[];
      nested: { key: string };
    }
    const hasher = createStringHasher() as unknown as Hasher<string>;
    const tree = new MerkleTree<string, ComplexMeta>(3, hasher);

    const meta1: ComplexMeta = { id: 1, tags: ['a', 'b'], nested: { key: 'x' } };
    const meta2: ComplexMeta = { id: 2, tags: ['c'], nested: { key: 'y' } };

    tree.insert('v1', meta1);
    tree.insert('v2', meta2);

    expect(tree.getMeta(0)).toEqual(meta1);
    expect(tree.getMeta(1)).toEqual(meta2);
  });

  it('returns null for empty tree', () => {
    const tree = new MerkleTree(2, createStringHasher());

    expect(tree.getMeta(0)).toBeNull();
  });

  it('returns null when index exceeds leaf count', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm0');
    tree.insert('b', 'm1');

    expect(tree.getMeta(2)).toBeNull();
    expect(tree.getMeta(10)).toBeNull();
    expect(tree.getMeta(100)).toBeNull();
  });

  it('returns null for negative index', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm0');

    expect(tree.getMeta(-1)).toBeNull();
  });

  it('returns null for non-integer index', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm0');

    expect(tree.getMeta(0.5)).toBeNull();
    expect(tree.getMeta(NaN)).toBeNull();
  });

  it('returns meta after further inserts following seeding', () => {
    const tree = new MerkleTree(3, createStringHasher(), [
      { value: 'a', meta: 'seeded-a' },
      { value: 'b', meta: 'seeded-b' }
    ]);
    tree.insert('c', 'inserted-c');

    expect(tree.getMeta(0)).toBe('seeded-a');
    expect(tree.getMeta(1)).toBe('seeded-b');
    expect(tree.getMeta(2)).toBe('inserted-c');
  });

  it('returns null meta for seeded items without meta', () => {
    const tree = new MerkleTree(2, createStringHasher(), [
      { value: 'a' },
      { value: 'b' },
      { value: 'c' }
    ]);

    expect(tree.getMeta(0)).toBeNull();
    expect(tree.getMeta(1)).toBeNull();
    expect(tree.getMeta(2)).toBeNull();
  });

  it('preserves meta values over multiple depth expansions', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 17; i++) {
      tree.insert(`v-${i}`, `meta-${i}`);
    }

    for (let i = 0; i < 17; i++) {
      expect(tree.getMeta(i)).toBe(`meta-${i}`);
    }
  });

  it('handles large tree (arity=2, 200 items) getMeta lookups', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 200; i++) {
      tree.insert(`v-${i}`, `meta-${i}`);
    }

    // Spot-check first, middle, last, and several random indices
    expect(tree.getMeta(0)).toBe('meta-0');
    expect(tree.getMeta(1)).toBe('meta-1');
    expect(tree.getMeta(99)).toBe('meta-99');
    expect(tree.getMeta(127)).toBe('meta-127');
    expect(tree.getMeta(199)).toBe('meta-199');
    expect(tree.getMeta(200)).toBeNull();
  });
});

describe('rootDigest', () => {
  it('returns a Uint8Array for single-item tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');

    const digest = tree.rootDigest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBeGreaterThan(0);
  });

  it('returns a Uint8Array for multi-item tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');

    const digest = tree.rootDigest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBeGreaterThan(0);
  });

  it('returns consistent root digest for same insertion sequence', () => {
    const tree1 = new MerkleTree(2, createStringHasher());
    tree1.insert('a', 'm1');
    tree1.insert('b', 'm2');

    const tree2 = new MerkleTree(2, createStringHasher());
    tree2.insert('a', 'm1');
    tree2.insert('b', 'm2');

    expect(tree1.rootDigest()).toEqual(tree2.rootDigest());
  });

  it('returns different root digest for different insertion sequences', () => {
    const tree1 = new MerkleTree(2, createStringHasher());
    tree1.insert('a', 'm1');
    tree1.insert('b', 'm2');

    const tree2 = new MerkleTree(2, createStringHasher());
    tree2.insert('b', 'm2');
    tree2.insert('a', 'm1');

    expect(tree1.rootDigest()).not.toEqual(tree2.rootDigest());
  });

  it('changes root digest after inserting a new leaf', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm1');
    const digestBefore = tree.rootDigest();

    tree.insert('b', 'm2');
    const digestAfter = tree.rootDigest();

    expect(digestAfter).not.toEqual(digestBefore);
  });

  it('changes root digest after each depth expansion', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    const d1 = tree.rootDigest();

    tree.insert('b', 'm');
    const d2 = tree.rootDigest();

    tree.insert('c', 'm');
    const d3 = tree.rootDigest();

    tree.insert('d', 'm');
    const d4 = tree.rootDigest();

    // Each insert should produce a different digest
    const digests = [d1, d2, d3, d4];
    for (let i = 0; i < digests.length; i++) {
      for (let j = i + 1; j < digests.length; j++) {
        expect(digests[i]).not.toEqual(digests[j]);
      }
    }
  });

  it('throws error when tree is empty', () => {
    const tree = new MerkleTree(2, createStringHasher());

    expect(() => tree.rootDigest()).toThrow('Tree is empty');
  });

  it('returns same digest as getHash([])', () => {
    const tree = new MerkleTree(3, createStringHasher());
    tree.insert('a', 'm1');
    tree.insert('b', 'm2');
    tree.insert('c', 'm3');

    expect(tree.rootDigest()).toEqual(tree.getHash([]));
  });

  it('works after seeding with items', () => {
    const tree = new MerkleTree(2, createStringHasher(), [
      { value: 'x' },
      { value: 'y' },
      { value: 'z' }
    ]);

    const digest = tree.rootDigest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBeGreaterThan(0);
  });

  it('matches root digest between seeded and sequentially built trees', () => {
    const seeded = new MerkleTree(2, createStringHasher(), [
      { value: 'a' },
      { value: 'b' },
      { value: 'c' }
    ]);

    const sequential = new MerkleTree(2, createStringHasher());
    sequential.insert('a', undefined as unknown as string);
    sequential.insert('b', undefined as unknown as string);
    sequential.insert('c', undefined as unknown as string);

    expect(seeded.rootDigest()).toEqual(sequential.rootDigest());
  });

  it('produces deterministic root digest for identical seed data', () => {
    const items = [
      { value: 'alpha' },
      { value: 'beta' },
      { value: 'gamma' },
      { value: 'delta' }
    ];
    const t1 = new MerkleTree(2, createStringHasher(), items);
    const t2 = new MerkleTree(2, createStringHasher(), items);

    expect(t1.rootDigest()).toEqual(t2.rootDigest());
  });
});

describe('fromJSON', () => {
  it('restores tree identical to original via toJSON round-trip', () => {
    const original = new MerkleTree(2, createStringHasher());
    original.insert('a', 'm1');
    original.insert('b', 'm2');

    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, createStringHasher());

    expect(restored.arity).toBe(original.arity);
    expect(restored.rootDigest()).toEqual(original.rootDigest());
    expect(restored.getHash([0])).toEqual(original.getHash([0]));
    expect(restored.getHash([1])).toEqual(original.getHash([1]));
  });

  it('preserves getMeta values after JSON round-trip', () => {
    const original = new MerkleTree(3, createStringHasher());
    original.insert('x', 'meta-x');
    original.insert('y', 'meta-y');
    original.insert('z', 'meta-z');

    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, createStringHasher());

    expect(restored.getMeta(0)).toBe('meta-x');
    expect(restored.getMeta(1)).toBe('meta-y');
    expect(restored.getMeta(2)).toBe('meta-z');
    expect(restored.getMeta(3)).toBeNull();
  });

  it('preserves deeply nested structure after JSON round-trip', () => {
    const original = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 10; i++) {
      original.insert(`v-${i}`, `m-${i}`);
    }

    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, createStringHasher());

    // Verify every leaf hash and meta
    expect(restored.rootDigest()).toEqual(original.rootDigest());
    for (let i = 0; i < 10; i++) {
      expect(restored.getMeta(i)).toBe(`m-${i}`);
    }
  });

  it('supports further inserts after restoration', () => {
    const original = new MerkleTree(2, createStringHasher());
    original.insert('a', 'm1');

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());
    restored.insert('b', 'm2');

    expect(restored.getMeta(0)).toBe('m1');
    expect(restored.getMeta(1)).toBe('m2');
    expect(restored.arity).toBe(2);
  });

  it('handles empty tree round-trip', () => {
    const original = new MerkleTree(4, createStringHasher());
    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, createStringHasher());

    expect(restored.arity).toBe(4);
    expect(() => restored.rootDigest()).toThrow('Tree is empty');
    expect(() => restored.getHash([])).toThrow('Tree is empty');
    expect(restored.getMeta(0)).toBeNull();
  });

  it('restores trees with different arities correctly', () => {
    const original = new MerkleTree(5, createStringHasher());
    original.insert('a', 'm1');
    original.insert('b', 'm2');

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());
    expect(restored.arity).toBe(5);
    expect(restored.rootDigest()).toEqual(original.rootDigest());
  });

  it('preserves getHash results for all paths after round-trip', () => {
    const original = new MerkleTree(3, createStringHasher());
    for (let i = 0; i < 9; i++) {
      original.insert(`v-${i}`, `m-${i}`);
    }

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());

    // Root
    expect(restored.getHash([])).toEqual(original.getHash([]));
    // Depth 1 children
    expect(restored.getHash([0])).toEqual(original.getHash([0]));
    expect(restored.getHash([1])).toEqual(original.getHash([1]));
    expect(restored.getHash([2])).toEqual(original.getHash([2]));
    // Depth 2 leaves
    expect(restored.getHash([0, 0])).toEqual(original.getHash([0, 0]));
    expect(restored.getHash([2, 2])).toEqual(original.getHash([2, 2]));
    // Non-existent path
    expect(restored.getHash([5])).toBeNull();
    expect(restored.getHash([99])).toBeNull();
  });

  it('round-trips tree with single node (no children)', () => {
    const original = new MerkleTree(2, createStringHasher());
    original.insert('only', 'sole-meta');

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());
    expect(restored.rootDigest()).toEqual(original.rootDigest());
    expect(restored.getMeta(0)).toBe('sole-meta');
    expect(restored.getHash([])).toEqual(original.getHash([]));
  });

  it('round-trips tree with exact-arity leaf fill', () => {
    const original = new MerkleTree(3, createStringHasher());
    original.insert('a', 'm0');
    original.insert('b', 'm1');
    original.insert('c', 'm2');

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());
    expect(restored.rootDigest()).toEqual(original.rootDigest());
    expect(restored.getMeta(0)).toBe('m0');
    expect(restored.getMeta(1)).toBe('m1');
    expect(restored.getMeta(2)).toBe('m2');
  });
});

describe('maxDepth', () => {
  it('is 0 for empty tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    expect(tree.maxDepth).toBe(0);
  });

  it('is 1 for tree with single leaf', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    expect(tree.maxDepth).toBe(1);
  });

  it('increases on depth expansion (binary tree)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm'); // maxDepth=1
    tree.insert('b', 'm'); // maxDepth=1
    tree.insert('c', 'm'); // maxDepth=2
    expect(tree.maxDepth).toBe(2);
    tree.insert('d', 'm'); // maxDepth=2
    tree.insert('e', 'm'); // maxDepth=3
    expect(tree.maxDepth).toBe(3);
  });

  it('matches seeded maxDepth with sequential inserts', () => {
    const seed = new MerkleTree(3, createStringHasher(), [
      { value: 'a' },
      { value: 'b' },
      { value: 'c' },
      { value: 'd' }
    ]);

    const seq = new MerkleTree(3, createStringHasher());
    seq.insert('a', undefined as unknown as string);
    seq.insert('b', undefined as unknown as string);
    seq.insert('c', undefined as unknown as string);
    seq.insert('d', undefined as unknown as string);

    expect(seed.maxDepth).toBe(seq.maxDepth);
  });

  it('is preserved after JSON round-trip', () => {
    const tree = new MerkleTree(4, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');

    const restored = MerkleTree.fromJSON(tree.toJSON(), createStringHasher());
    expect(restored.maxDepth).toBe(tree.maxDepth);
  });
});

describe('leafCount', () => {
  it('is 0 for empty tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    expect(tree.leafCount).toBe(0);
  });

  it('is 1 after first insert', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    expect(tree.leafCount).toBe(1);
  });

  it('matches number of inserted items (binary, within single depth)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    expect(tree.leafCount).toBe(2);
  });

  it('matches number of inserted items across depth expansions', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 10; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }
    expect(tree.leafCount).toBe(10);
  });

  it('matches number of seeded items', () => {
    const tree = new MerkleTree(3, createStringHasher(), [
      { value: 'a' },
      { value: 'b' },
      { value: 'c' },
      { value: 'd' },
      { value: 'e' }
    ]);
    expect(tree.leafCount).toBe(5);
  });

  it('matches total after seeding then inserting more', () => {
    const tree = new MerkleTree(2, createStringHasher(), [
      { value: 'a' },
      { value: 'b' }
    ]);
    tree.insert('c', 'm');
    tree.insert('d', 'm');
    expect(tree.leafCount).toBe(4);
  });

  it('handles ternary tree with many items', () => {
    const tree = new MerkleTree(3, createStringHasher());
    for (let i = 0; i < 27; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }
    expect(tree.leafCount).toBe(27);
  });

  it('handles binary tree with 500 items', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 500; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }
    expect(tree.leafCount).toBe(500);
  });

  it('is preserved after JSON round-trip', () => {
    const tree = new MerkleTree(4, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');

    const restored = MerkleTree.fromJSON(tree.toJSON(), createStringHasher());
    expect(restored.leafCount).toBe(tree.leafCount);
  });

  it('updates correctly after further inserts on restored tree', () => {
    const original = new MerkleTree(2, createStringHasher());
    original.insert('a', 'm');

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());
    restored.insert('b', 'm');
    restored.insert('c', 'm');

    expect(restored.leafCount).toBe(3);
  });
});

describe('getChildrenHashes', () => {
  it('returns root children for empty path', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');

    const hashes = tree.getChildrenHashes([]);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).toBeInstanceOf(Uint8Array);
    expect(hashes[1]).toBeInstanceOf(Uint8Array);
  });

  it('returns children of a nested node', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');

    // Root has 2 children; child[0] has 2 children (a, b)
    const hashes = tree.getChildrenHashes([0]);
    expect(hashes).toHaveLength(2);
  });

  it('returns empty array for leaf-level path (no children)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');

    // Path [0] is the leaf — no children
    const hashes = tree.getChildrenHashes([0]);
    expect(hashes).toEqual([]);
  });

  it('returns empty array for non-existent path', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');

    expect(tree.getChildrenHashes([99])).toEqual([]);
    expect(tree.getChildrenHashes([0, 99])).toEqual([]);
  });

  it('returns empty array for empty tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    expect(tree.getChildrenHashes([])).toEqual([]);
    expect(tree.getChildrenHashes([0])).toEqual([]);
  });

  it('returns child hashes matching getHash results', () => {
    const tree = new MerkleTree(3, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');

    const children = tree.getChildrenHashes([]);
    for (let i = 0; i < children.length; i++) {
      expect(children[i]).toEqual(tree.getHash([i]));
    }
  });

  it('returns hashes consistent after JSON round-trip', () => {
    const original = new MerkleTree(2, createStringHasher());
    original.insert('a', 'm');
    original.insert('b', 'm');
    original.insert('c', 'm');

    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());

    expect(restored.getChildrenHashes([])).toEqual(original.getChildrenHashes([]));
    expect(restored.getChildrenHashes([0])).toEqual(original.getChildrenHashes([0]));
    expect(restored.getChildrenHashes([1])).toEqual(original.getChildrenHashes([1]));
    expect(restored.getChildrenHashes([99])).toEqual([]);
  });

  it('returns correct number of children per level in unbalanced tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    // 3 items in binary tree: root has 2 children, child[0] has 2 leaves, child[1] has 1 leaf
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');

    expect(tree.getChildrenHashes([])).toHaveLength(2); // root has 2 children
    expect(tree.getChildrenHashes([0])).toHaveLength(2); // n0 has 2 leaves
    expect(tree.getChildrenHashes([1])).toHaveLength(1); // n1 has 1 leaf
  });

  it('handles binary tree with 10 items', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 10; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }

    // Should not throw, returns arrays of Uint8Arrays
    expect(tree.getChildrenHashes([])).toBeInstanceOf(Array);
    expect(tree.getChildrenHashes([0, 0])).toBeInstanceOf(Array);
  });
});

describe('getIndexFromPath', () => {
  it('returns 0 for empty path (root)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    expect(tree.getIndexFromPath([])).toBe(0);
  });

  it('returns correct index for single leaf in binary tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    expect(tree.getIndexFromPath([0])).toBe(0);
  });

  it('returns correct index for two leaf binary tree', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    expect(tree.getIndexFromPath([0])).toBe(0);
    expect(tree.getIndexFromPath([1])).toBe(1);
  });

  it('returns correct leaf indices after depth expansion (arity=2, 3 items)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');
    // maxDepth=2, leaves at [0,0], [0,1], [1,0]
    expect(tree.getIndexFromPath([0, 0])).toBe(0);
    expect(tree.getIndexFromPath([0, 1])).toBe(1);
    expect(tree.getIndexFromPath([1, 0])).toBe(2);
  });

  it('matches leaf indices for all items in ternary tree', () => {
    const tree = new MerkleTree(3, createStringHasher());
    for (let i = 0; i < 9; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }
    // maxDepth=2, paths: [0,0]=0, [0,1]=1, [0,2]=2, [1,0]=3, ...
    expect(tree.getIndexFromPath([0, 0])).toBe(0);
    expect(tree.getIndexFromPath([0, 1])).toBe(1);
    expect(tree.getIndexFromPath([0, 2])).toBe(2);
    expect(tree.getIndexFromPath([1, 0])).toBe(3);
    expect(tree.getIndexFromPath([1, 1])).toBe(4);
    expect(tree.getIndexFromPath([1, 2])).toBe(5);
    expect(tree.getIndexFromPath([2, 0])).toBe(6);
    expect(tree.getIndexFromPath([2, 1])).toBe(7);
    expect(tree.getIndexFromPath([2, 2])).toBe(8);
  });

  it('returns starting leaf index for internal node path', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 10; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }
    // maxDepth=4, path [0] is first child of root, should give index 0
    expect(tree.getIndexFromPath([0])).toBe(0);
    // path [1] is second child of root, starts at leaf index 8
    expect(tree.getIndexFromPath([1])).toBe(8);
  });

  it('round-trips correctly with getMeta internal path computation', () => {
    const tree = new MerkleTree(3, createStringHasher());
    for (let i = 0; i < 15; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }

    // Reconstruct the path-to-index formula that getMeta uses internally
    function indexToPath(idx: number, arity: number, maxDepth: number): number[] {
      const path: number[] = [];
      for (let d = maxDepth - 1; d >= 0; d--) {
        const power = Math.pow(arity, d);
        path.push(Math.floor(idx / power));
        idx = idx % power;
      }
      return path;
    }

    for (let i = 0; i < 15; i++) {
      const path = indexToPath(i, tree.arity, tree.maxDepth);
      expect(tree.getIndexFromPath(path)).toBe(i);
    }
  });

  it('returns correct index for last leaf matching leafCount-1', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 7; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }
    // Build the rightmost path by using the known structure:
    // maxDepth=3, leafCount=7 → leaves are at [0,0,0]=0, [0,0,1]=1, [0,1,0]=2,
    // [0,1,1]=3, [1,0,0]=4, [1,0,1]=5, [1,1,0]=6
    // Rightmost leaf is at index 6 → path in binary tree = [1,1,0]
    const path = [1, 1, 0];
    expect(tree.getIndexFromPath(path)).toBe(tree.leafCount - 1);
  });

  it('returns -1 for path exceeding maxDepth', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    expect(tree.getIndexFromPath([0, 0, 0])).toBe(-1);
    expect(tree.getIndexFromPath([0, 0, 0, 0])).toBe(-1);
  });

  it('returns -1 for path exceeding maxDepth in seeded tree', () => {
    const tree = new MerkleTree(3, createStringHasher(), [
      { value: 'a' },
      { value: 'b' },
      { value: 'c' }
    ]);
    expect(tree.getIndexFromPath([0, 0, 0])).toBe(-1);
  });

  it('works for empty tree (maxDepth=0)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    expect(tree.getIndexFromPath([])).toBe(0);
    expect(tree.getIndexFromPath([0])).toBe(-1);
  });

  it('preserves behavior after JSON round-trip', () => {
    const tree = new MerkleTree(2, createStringHasher());
    tree.insert('a', 'm');
    tree.insert('b', 'm');
    tree.insert('c', 'm');

    const restored = MerkleTree.fromJSON(tree.toJSON(), createStringHasher());

    expect(restored.getIndexFromPath([])).toBe(tree.getIndexFromPath([]));
    expect(restored.getIndexFromPath([0, 0])).toBe(tree.getIndexFromPath([0, 0]));
    expect(restored.getIndexFromPath([1, 0])).toBe(tree.getIndexFromPath([1, 0]));
  });
});

describe('edge cases', () => {
  it('inserts 500 items into binary tree without error', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 500; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }

    expect(tree.arity).toBe(2);
    expect(tree.rootDigest()).toBeInstanceOf(Uint8Array);
    // Verify a few random leaves
    expect(tree.getMeta(0)).toBe('m-0');
    expect(tree.getMeta(255)).toBe('m-255');
    expect(tree.getMeta(499)).toBe('m-499');
    expect(tree.getMeta(500)).toBeNull();
  });

  it('inserts 500 items into ternary tree without error', () => {
    const tree = new MerkleTree(3, createStringHasher());
    for (let i = 0; i < 500; i++) {
      tree.insert(`v-${i}`, `m-${i}`);
    }

    expect(tree.arity).toBe(3);
    // Spot-check leaf meta
    expect(tree.getMeta(0)).toBe('m-0');
    expect(tree.getMeta(499)).toBe('m-499');
  });

  it('maintains correct leaf metadata for all items after multiple depth expansions (arity=2, 100 items)', () => {
    const tree = new MerkleTree(2, createStringHasher());
    for (let i = 0; i < 100; i++) {
      tree.insert(`value-${i}`, `meta-${i}`);
    }

    for (let i = 0; i < 100; i++) {
      expect(tree.getMeta(i)).toBe(`meta-${i}`);
    }
  });

  it('works with custom object hasher and round-trip', () => {
    interface RealItem {
      id: number;
      data: string;
    }

    const customHasher: Hasher<RealItem> = {
      hash: (item: RealItem) => {
        const encoder = new TextEncoder();
        return encoder.encode(`${item.id}:${item.data}`);
      }
    };

    const tree = new MerkleTree<RealItem, string>(2, customHasher);
    tree.insert({ id: 1, data: 'hello' }, 'tag1');
    tree.insert({ id: 2, data: 'world' }, 'tag2');

    const json = tree.toJSON();
    const restored = MerkleTree.fromJSON(json, customHasher);

    expect(restored.rootDigest()).toEqual(tree.rootDigest());
    expect(restored.getMeta(0)).toBe('tag1');
    expect(restored.getMeta(1)).toBe('tag2');
  });

  it('throws on rootDigest on empty restored tree', () => {
    const original = new MerkleTree(3, createStringHasher());
    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());

    expect(() => restored.rootDigest()).toThrow('Tree is empty');
  });

  it('throws on getHash on empty restored tree', () => {
    const original = new MerkleTree(3, createStringHasher());
    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());

    expect(() => restored.getHash([])).toThrow('Tree is empty');
  });

  it('returns null for getMeta on empty restored tree', () => {
    const original = new MerkleTree(2, createStringHasher());
    const restored = MerkleTree.fromJSON(original.toJSON(), createStringHasher());

    expect(restored.getMeta(0)).toBeNull();
    expect(restored.getMeta(1)).toBeNull();
  });
});

