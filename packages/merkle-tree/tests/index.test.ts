import { describe, expect, it } from 'vitest';

import { byteHasher, type Hasher, MerkleTree, stringHasher } from '~/index';

// ---------------------------------------------------------------------------
// Deterministic mock hasher for predictable assertions
// ---------------------------------------------------------------------------
function makeByteHasher(): Hasher<Uint8Array> & { calls: Uint8Array[] } {
  const calls: Uint8Array[] = [];
  let counter = 1;
  return {
    calls,
    hash(value: Uint8Array) {
      calls.push(value);
      // Deterministic output based on input length so we can assert on digests
      const out = new Uint8Array(32);
      out[0] = value.length;
      out[1] = counter++;
      return out;
    }
  };
}

// =========================================================================
// Constructor
// =========================================================================
describe('MerkleTree constructor', () => {
  it('throws when arity is less than 2', () => {
    expect(() => new MerkleTree(1, makeByteHasher())).toThrow('Arity must be greater than 1');
    expect(() => new MerkleTree(0, makeByteHasher())).toThrow('Arity must be greater than 1');
    expect(() => new MerkleTree(-1, makeByteHasher())).toThrow('Arity must be greater than 1');
  });

  it('creates an empty tree when no items are provided', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    expect(tree.isEmpty()).toBe(true);
    expect(tree.leafCount).toBe(0);
    expect(tree.maxDepth).toBe(0);
    expect(tree.arity).toBe(2);
  });

  it('creates an empty tree when items is an empty array', () => {
    const tree = new MerkleTree(2, makeByteHasher(), []);
    expect(tree.isEmpty()).toBe(true);
    expect(tree.leafCount).toBe(0);
    expect(tree.maxDepth).toBe(0);
  });

  it('creates a single-leaf tree (arity 2) from one item', () => {
    const hasher = makeByteHasher();
    const items = [{ meta: 'abc', value: new Uint8Array([1]) }];
    const tree = new MerkleTree(2, hasher, items);

    expect(tree.isEmpty()).toBe(false);
    expect(tree.leafCount).toBe(1);
    expect(tree.maxDepth).toBe(1);
    // The single leaf inserts via the insert() code path, so the mock was called
    expect(hasher.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('creates a single-leaf tree (arity 3) from one item', () => {
    const hasher = makeByteHasher();
    const items = [{ meta: 'x', value: new Uint8Array([5]) }];
    const tree = new MerkleTree(3, hasher, items);

    expect(tree.isEmpty()).toBe(false);
    expect(tree.leafCount).toBe(1);
    expect(tree.maxDepth).toBe(1);
  });

  it('builds a perfect binary tree (arity 2, 4 items = 2 levels)', () => {
    const hasher = makeByteHasher();
    const items = [
      { meta: 0, value: new Uint8Array([1]) },
      { meta: 1, value: new Uint8Array([2]) },
      { meta: 2, value: new Uint8Array([3]) },
      { meta: 3, value: new Uint8Array([4]) }
    ];
    const tree = new MerkleTree(2, hasher, items);

    expect(tree.isEmpty()).toBe(false);
    expect(tree.leafCount).toBe(4);
    // depth = ceil(log_2(4)) = 2
    expect(tree.maxDepth).toBe(2);
    expect(tree.arity).toBe(2);

    // Root should be hashed from children digests
    const rootDigest = tree.rootDigest();
    expect(rootDigest).toBeInstanceOf(Uint8Array);
    expect(rootDigest.length).toBe(32);
  });

  it('builds a tree with arity 3 and 9 items (perfect fill)', () => {
    const hasher = makeByteHasher();
    const items = Array.from({ length: 9 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(3, hasher, items);

    expect(tree.leafCount).toBe(9);
    // depth = ceil(log_3(9)) = 2
    expect(tree.maxDepth).toBe(2);
  });

  it('builds a tree with non-perfect fill (arity 2, 3 items)', () => {
    const hasher = makeByteHasher();
    const items = [
      { meta: 'a', value: new Uint8Array([1]) },
      { meta: 'b', value: new Uint8Array([2]) },
      { meta: 'c', value: new Uint8Array([3]) }
    ];
    const tree = new MerkleTree(2, hasher, items);

    expect(tree.leafCount).toBe(3);
    // depth = ceil(log_2(3)) = 2
    expect(tree.maxDepth).toBe(2);

    const rootDigest = tree.rootDigest();
    expect(rootDigest).toBeInstanceOf(Uint8Array);
  });

  it('builds a tree with arity 4 and 5 items', () => {
    const hasher = makeByteHasher();
    const items = Array.from({ length: 5 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(4, hasher, items);
    // depth = ceil(log_4(5)) = 2
    expect(tree.maxDepth).toBe(2);
    expect(tree.leafCount).toBe(5);
  });

  it('computes deterministic root digests for identical inputs', () => {
    const items: Array<{ meta: number; value: string }> = [
      { meta: 0, value: 'one' },
      { meta: 1, value: 'two' }
    ];
    const treeA = new MerkleTree(2, stringHasher, items);
    const treeB = new MerkleTree(2, stringHasher, items);

    expect(treeA.rootDigest()).toEqual(treeB.rootDigest());
  });
});

// =========================================================================
// Properties
// =========================================================================
describe('MerkleTree properties', () => {
  it('arity returns the configured branching factor', () => {
    const tree = new MerkleTree(5, makeByteHasher());
    expect(tree.arity).toBe(5);
  });

  it('leafCount returns the correct number of leaves', () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(2, makeByteHasher(), items);
    expect(tree.leafCount).toBe(7);
  });
});

// =========================================================================
// insert
// =========================================================================
describe('MerkleTree.insert', () => {
  it('inserts the first value into an empty tree', () => {
    const hasher = makeByteHasher();
    const tree = new MerkleTree(2, hasher);
    tree.insert([{ meta: 'first', value: new Uint8Array([10]) }]);

    expect(tree.isEmpty()).toBe(false);
    expect(tree.leafCount).toBe(1);
    expect(tree.maxDepth).toBe(1);
    expect(tree.rootDigest()).toBeInstanceOf(Uint8Array);
  });

  it('inserts values sequentially and maintains correct leafCount', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    tree.insert([{ meta: 0, value: new Uint8Array([0]) }]);
    expect(tree.leafCount).toBe(1);
    expect(tree.maxDepth).toBe(1);

    tree.insert([{ meta: 1, value: new Uint8Array([1]) }]);
    expect(tree.leafCount).toBe(2);
    expect(tree.maxDepth).toBe(1);

    tree.insert([{ meta: 2, value: new Uint8Array([2]) }]);
    expect(tree.leafCount).toBe(3);
    // binary tree, 3 leaves → depth 2
    expect(tree.maxDepth).toBe(2);
  });

  it('inserts multiple values at once', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    tree.insert([
      { meta: 'a', value: new Uint8Array([1]) },
      { meta: 'b', value: new Uint8Array([2]) }
    ]);
    expect(tree.leafCount).toBe(2);
    expect(tree.maxDepth).toBe(1);
  });

  it('triggers depth increase when inserting beyond tree capacity (binary)', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    // Insert 4 items - fills a perfect binary tree at depth 2
    tree.insert([
      { meta: 0, value: new Uint8Array([0]) },
      { meta: 1, value: new Uint8Array([1]) },
      { meta: 2, value: new Uint8Array([2]) },
      { meta: 3, value: new Uint8Array([3]) }
    ]);
    expect(tree.maxDepth).toBe(2);

    // One more triggers depth increase to 3
    tree.insert([{ meta: 4, value: new Uint8Array([4]) }]);
    expect(tree.maxDepth).toBe(3);
    expect(tree.leafCount).toBe(5);
  });

  it('triggers depth increase for arity 3', () => {
    const tree = new MerkleTree(3, makeByteHasher());
    // 9 items fills depth 2 perfectly
    tree.insert(
      Array.from({ length: 9 }, (_, i) => ({
        meta: i,
        value: new Uint8Array([i])
      }))
    );
    expect(tree.maxDepth).toBe(2);

    // 10th leaf triggers depth increase
    tree.insert([{ meta: 9, value: new Uint8Array([9]) }]);
    expect(tree.maxDepth).toBe(3);
    expect(tree.leafCount).toBe(10);
  });

  it('maintains valid root digest after repeated inserts', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    for (let i = 0; i < 6; i++) {
      tree.insert([{ meta: i, value: new Uint8Array([i]) }]);
      const digest = tree.rootDigest();
      expect(digest).toBeInstanceOf(Uint8Array);
      expect(digest.length).toBe(32);
    }
  });

  it('hashes each leaf value exactly once per insert call', () => {
    const hasher = makeByteHasher();
    const tree = new MerkleTree(2, hasher);
    tree.insert([{ meta: 'x', value: new Uint8Array([99]) }]);
    // The first insert also hashes the digest with byteHasher for root
    expect(hasher.calls.length).toBe(1);
  });

  it('rehashes internal nodes up to the root after each insert', () => {
    // Build a tree with 2 leaves, then insert a 3rd that forces rehash up the path
    const hasher = makeByteHasher();
    const tree = new MerkleTree(2, hasher, [
      { meta: 0, value: new Uint8Array([0]) },
      { meta: 1, value: new Uint8Array([1]) }
    ]);
    const rootBefore = tree.rootDigest();

    tree.insert([{ meta: 2, value: new Uint8Array([2]) }]);
    const rootAfter = tree.rootDigest();

    // Root should have changed since tree structure changed
    expect(rootAfter).not.toEqual(rootBefore);
  });
});

// =========================================================================
// getHash
// =========================================================================
describe('MerkleTree.getHash', () => {
  it('returns the root hash for an empty path', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    const root = tree.rootDigest();
    expect(tree.getHash([])).toEqual(root);
  });

  it('returns a leaf hash given the full path', () => {
    const items = [
      { meta: 'a', value: new Uint8Array([1]) },
      { meta: 'b', value: new Uint8Array([2]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    // Binary tree, 2 leaves, depth=1: leaf index 0 → path [0], leaf index 1 → path [1]
    const leafHash = tree.getHash([1]);
    expect(leafHash).toBeInstanceOf(Uint8Array);
    expect(leafHash!.length).toBe(32);
  });

  it('returns null when the path index exceeds node width', () => {
    const items = [
      { meta: 'a', value: new Uint8Array([1]) },
      { meta: 'b', value: new Uint8Array([2]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    // Binary tree with 2 leaves: depth=1, root width=2, so path [2] is out of bounds
    expect(tree.getHash([2])).toBeNull();
  });

  it('throws when the tree is empty', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    expect(() => tree.getHash([])).toThrow('Tree is empty');
  });

  it('returns null for a path that goes beyond leaf depth', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    // depth=1, path [0,0] goes deeper than the tree
    expect(tree.getHash([0, 0])).toBeNull();
  });
});

// =========================================================================
// getChildrenHashes
// =========================================================================
describe('MerkleTree.getChildrenHashes', () => {
  it('returns an empty array for an empty tree', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    expect(tree.getChildrenHashes([])).toEqual([]);
  });

  it('returns children of the root for path []', () => {
    const items = [
      { meta: 0, value: new Uint8Array([1]) },
      { meta: 1, value: new Uint8Array([2]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    const hashes = tree.getChildrenHashes([]);
    expect(hashes).toHaveLength(2);
    expect(hashes[0]).toBeInstanceOf(Uint8Array);
    expect(hashes[1]).toBeInstanceOf(Uint8Array);
  });

  it('returns an empty array for a leaf node (no children)', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    // depth=1, leaf at path [0] has no children
    const hashes = tree.getChildrenHashes([0]);
    expect(hashes).toEqual([]);
  });

  it('returns children of an internal node by path', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(2, makeByteHasher(), items);
    // depth=2, children of path [0] are the first two leaves
    const hashes = tree.getChildrenHashes([0]);
    expect(hashes).toHaveLength(2);
  });

  it('returns empty array for out-of-bounds path', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    expect(tree.getChildrenHashes([99])).toEqual([]);
  });
});

// =========================================================================
// getMeta
// =========================================================================
describe('MerkleTree.getMeta', () => {
  it('returns the meta of a leaf by index', () => {
    const items = [
      { meta: 'alpha', value: new Uint8Array([1]) },
      { meta: 'beta', value: new Uint8Array([2]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);

    expect(tree.getMeta(0)).toBe('alpha');
    expect(tree.getMeta(1)).toBe('beta');
  });

  it('returns null for a negative index', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 'x', value: new Uint8Array([1]) }]);
    expect(tree.getMeta(-1)).toBeNull();
  });

  it('returns null for an out-of-range index', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 'x', value: new Uint8Array([1]) }]);
    expect(tree.getMeta(1)).toBeNull();
    expect(tree.getMeta(100)).toBeNull();
  });

  it('returns null for a non-integer index', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 'x', value: new Uint8Array([1]) }]);
    expect(tree.getMeta(0.5)).toBeNull();
  });

  it('returns null for an empty tree', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    expect(tree.getMeta(0)).toBeNull();
  });

  it('retrieves metadata after inserts', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    tree.insert([{ meta: 'first', value: new Uint8Array([1]) }]);
    tree.insert([{ meta: 'second', value: new Uint8Array([2]) }]);

    expect(tree.getMeta(0)).toBe('first');
    expect(tree.getMeta(1)).toBe('second');
  });

  it('returns null for meta when meta is undefined', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    tree.insert([{ meta: undefined as unknown as string, value: new Uint8Array([1]) }]);
    expect(tree.getMeta(0)).toBeNull();
  });
});

// =========================================================================
// getIndexFromPath
// =========================================================================
describe('MerkleTree.getIndexFromPath', () => {
  it('returns 0 for the first leaf path (binary, depth 2)', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(2, makeByteHasher(), items);
    // In a binary tree depth 2: leaf [0,0] → index 0
    expect(tree.getIndexFromPath([0, 0])).toBe(0);
  });

  it('returns the correct index for each leaf', () => {
    const items = Array.from({ length: 4 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(2, makeByteHasher(), items);
    expect(tree.getIndexFromPath([0, 0])).toBe(0);
    expect(tree.getIndexFromPath([0, 1])).toBe(1);
    expect(tree.getIndexFromPath([1, 0])).toBe(2);
    expect(tree.getIndexFromPath([1, 1])).toBe(3);
  });

  it('returns -1 when path is deeper than maxDepth', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    expect(tree.getIndexFromPath([0, 0, 0])).toBe(-1);
  });

  it('handles arity 3 paths correctly', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      meta: i,
      value: new Uint8Array([i])
    }));
    const tree = new MerkleTree(3, makeByteHasher(), items);
    // In a ternary tree depth 2: leaf [0,0] → index 0, [0,1] → 1, …, [2,2] → 8
    expect(tree.getIndexFromPath([0, 0])).toBe(0);
    expect(tree.getIndexFromPath([0, 1])).toBe(1);
    expect(tree.getIndexFromPath([1, 0])).toBe(3);
    expect(tree.getIndexFromPath([2, 2])).toBe(8);
  });
});

// =========================================================================
// getMetaByPath
// =========================================================================
describe('MerkleTree.getMetaByPath', () => {
  it('retrieves meta by path', () => {
    const items = [
      { meta: 'leaf0', value: new Uint8Array([1]) },
      { meta: 'leaf1', value: new Uint8Array([2]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    expect(tree.getMetaByPath([0])).toBe('leaf0');
    expect(tree.getMetaByPath([1])).toBe('leaf1');
  });

  it('returns null for an out-of-bounds path', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [
      { meta: 'only', value: new Uint8Array([1]) }
    ]);
    expect(tree.getMetaByPath([99])).toBeNull();
  });
});

// =========================================================================
// getIndexByMeta
// =========================================================================
describe('MerkleTree.getIndexByMeta', () => {
  it('finds the index of a meta value using binary search', () => {
    const items = [
      { meta: 10, value: new Uint8Array([1]) },
      { meta: 20, value: new Uint8Array([2]) },
      { meta: 30, value: new Uint8Array([3]) },
      { meta: 40, value: new Uint8Array([4]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    expect(tree.getIndexByMeta(10, (a, b) => a - b)).toBe(0);
    expect(tree.getIndexByMeta(20, (a, b) => a - b)).toBe(1);
    expect(tree.getIndexByMeta(30, (a, b) => a - b)).toBe(2);
    expect(tree.getIndexByMeta(40, (a, b) => a - b)).toBe(3);
  });

  it('returns -1 when meta is not found', () => {
    const items = [
      { meta: 10, value: new Uint8Array([1]) },
      { meta: 20, value: new Uint8Array([2]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    expect(tree.getIndexByMeta(15, (a, b) => a - b)).toBe(-1);
  });

  it('uses the provided comparator for comparison', () => {
    const items = [
      { meta: 'banana', value: new Uint8Array([1]) },
      { meta: 'cherry', value: new Uint8Array([2]) },
      { meta: 'apple', value: new Uint8Array([3]) }
    ];
    const tree = new MerkleTree(2, makeByteHasher(), items);
    // Sorted in insert order: banana, cherry, apple
    // Search with localeCompare — apple < banana < cherry
    const idx = tree.getIndexByMeta('cherry', (a, b) => a.localeCompare(b));
    expect(idx).toBe(1);
  });
});

// =========================================================================
// rootDigest / isEmpty
// =========================================================================
describe('MerkleTree.rootDigest', () => {
  it('returns a 32-byte Uint8Array for a non-empty tree', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    const digest = tree.rootDigest();
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('throws for an empty tree', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    expect(() => tree.rootDigest()).toThrow('Tree is empty');
  });
});

describe('MerkleTree.isEmpty', () => {
  it('returns true for a tree created without items', () => {
    const tree = new MerkleTree(2, makeByteHasher());
    expect(tree.isEmpty()).toBe(true);
  });

  it('returns false after inserting items', () => {
    const tree = new MerkleTree(2, makeByteHasher(), [{ meta: 0, value: new Uint8Array([1]) }]);
    expect(tree.isEmpty()).toBe(false);
  });
});

// =========================================================================
// Serialization
// =========================================================================
describe('MerkleTree serialization', () => {
  it('toJSON roundtrips via fromJSON', () => {
    const items = [
      { meta: 10, value: new Uint8Array([1]) },
      { meta: 20, value: new Uint8Array([2]) }
    ];
    const original = new MerkleTree(2, makeByteHasher(), items);
    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, makeByteHasher());

    expect(restored.arity).toBe(original.arity);
    expect(restored.leafCount).toBe(original.leafCount);
    expect(restored.maxDepth).toBe(original.maxDepth);
    expect(restored.rootDigest()).toEqual(original.rootDigest());
    expect(restored.getMeta(0)).toBe(original.getMeta(0));
    expect(restored.getMeta(1)).toBe(original.getMeta(1));
  });

  it('toJSON / fromJSON roundtrips an empty tree', () => {
    const original = new MerkleTree(3, makeByteHasher());
    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, makeByteHasher());

    expect(restored.isEmpty()).toBe(true);
    expect(restored.arity).toBe(3);
    expect(restored.leafCount).toBe(0);
  });

  it('fromJSON restores the hasher correctly (computed hashes match)', () => {
    const items = [
      { meta: 'a', value: 'hello' },
      { meta: 'b', value: 'world' }
    ];
    const original = new MerkleTree(2, stringHasher, items);
    const json = original.toJSON();
    const restored = MerkleTree.fromJSON(json, stringHasher);

    expect(restored.rootDigest()).toEqual(original.rootDigest());
  });

  it('toString and fromString roundtrip', () => {
    const items = [
      { meta: { id: 1 }, value: new Uint8Array([10, 20]) },
      { meta: { id: 2 }, value: new Uint8Array([30, 40]) }
    ];
    const original = new MerkleTree(2, makeByteHasher(), items);
    const str = original.toString();
    const restored = MerkleTree.fromString(str, makeByteHasher());

    expect(restored.arity).toBe(original.arity);
    expect(restored.leafCount).toBe(original.leafCount);
    expect(restored.maxDepth).toBe(original.maxDepth);
    expect(restored.rootDigest()).toEqual(original.rootDigest());
  });

  it('toString / fromString roundtrips an empty tree', () => {
    const original = new MerkleTree(4, makeByteHasher());
    const str = original.toString();
    const restored = MerkleTree.fromString(str, makeByteHasher());

    expect(restored.isEmpty()).toBe(true);
    expect(restored.arity).toBe(4);
  });
});

// =========================================================================
// Hasher implementations (byteHasher, stringHasher)
// =========================================================================
describe('byteHasher', () => {
  it('returns a 32-byte digest for any input', () => {
    const digest = byteHasher.hash(new Uint8Array([1, 2, 3]));
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('produces deterministic output', () => {
    const input = new Uint8Array([0xde, 0xad]);
    const a = byteHasher.hash(input);
    const b = byteHasher.hash(input);
    expect(a).toEqual(b);
  });

  it('produces different output for different inputs', () => {
    const a = byteHasher.hash(new Uint8Array([1]));
    const b = byteHasher.hash(new Uint8Array([2]));
    expect(a).not.toEqual(b);
  });

  it('is SHA3-256 (known test vector)', () => {
    // SHA3-256("") = a7ffc6f8bf1ed76651c14756a061d662...
    const empty = byteHasher.hash(new Uint8Array(0));
    expect(empty[0]).toBe(0xa7);
    expect(empty[1]).toBe(0xff);
  });
});

describe('stringHasher', () => {
  it('returns a 32-byte digest for any string', () => {
    const digest = stringHasher.hash('hello');
    expect(digest).toBeInstanceOf(Uint8Array);
    expect(digest.length).toBe(32);
  });

  it('produces deterministic output', () => {
    const a = stringHasher.hash('deterministic');
    const b = stringHasher.hash('deterministic');
    expect(a).toEqual(b);
  });

  it('produces different output for different strings', () => {
    const a = stringHasher.hash('foo');
    const b = stringHasher.hash('bar');
    expect(a).not.toEqual(b);
  });
});

// =========================================================================
// End-to-end: real hasher + tree operations
// =========================================================================
describe('End-to-end (real SHA3-256 hasher)', () => {
  it('builds a tree and verifies getHash/getMeta consistency', () => {
    const items = [
      { meta: 'tx1', value: 'first_transaction' },
      { meta: 'tx2', value: 'second_transaction' },
      { meta: 'tx3', value: 'third_transaction' }
    ];
    const tree = new MerkleTree(2, stringHasher, items);

    // All insertion-era digests should be accessible
    // Tree structure: root[A[leaf0,leaf1], B[leaf2]]
    expect(tree.getHash([0])).toBeInstanceOf(Uint8Array); // internal node A
    expect(tree.getHash([1])).toBeInstanceOf(Uint8Array); // internal node B
    expect(tree.getHash([0, 0])).toBeInstanceOf(Uint8Array); // leaf0
    expect(tree.getHash([0, 1])).toBeInstanceOf(Uint8Array); // leaf1
    expect(tree.getHash([1, 0])).toBeInstanceOf(Uint8Array); // leaf2

    // Meta retrieval (meta only stored on leaf nodes)
    // Leaves are at paths [0,0], [0,1], [1,0]
    expect(tree.getMetaByPath([0, 0])).toBe('tx1');
    expect(tree.getMetaByPath([0, 1])).toBe('tx2');
    expect(tree.getMetaByPath([1, 0])).toBe('tx3');
    expect(tree.getMeta(0)).toBe('tx1');
    expect(tree.getMeta(1)).toBe('tx2');
    expect(tree.getMeta(2)).toBe('tx3');

    // Children hashes at root
    const rootChildren = tree.getChildrenHashes([]);
    expect(rootChildren).toHaveLength(2);
  });

  it('inserts sequentially with real hasher and validates root digest changes', () => {
    const tree = new MerkleTree(2, stringHasher);
    const digests: Uint8Array[] = [];

    for (let i = 0; i < 5; i++) {
      tree.insert([{ meta: `leaf-${i}`, value: `value-${i}` }]);
      digests.push(tree.rootDigest());
    }

    // Each insert should produce a unique root digest (different tree state)
    for (let i = 1; i < digests.length; i++) {
      expect(digests[i]).not.toEqual(digests[i - 1]);
    }
  });
});
