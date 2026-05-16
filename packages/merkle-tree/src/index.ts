import { sha3_256 } from 'js-sha3';

import { Node, Tree } from './utils/tree';

export interface Hasher<T> {
  hash(value: T): Uint8Array;
}

export const byteHasher: Hasher<Uint8Array> = {
  hash(value: Uint8Array<ArrayBufferLike>): Uint8Array {
    return new Uint8Array(sha3_256.arrayBuffer(value));
  }
};

export const stringHasher: Hasher<string> = {
  hash(value: string): Uint8Array {
    return new Uint8Array(sha3_256.arrayBuffer(value));
  }
};

export class MerkleTree<T, TMeta = unknown> {
  get arity(): number {
    return this.#arity;
  }

  get leafCount(): number {
    let node = this.#tree.root;
    if (!node) return 0;

    let path = 0;
    for (let depth = 0; depth < this.#maxDepth; depth++) {
      const childIndex = node.width - 1;
      if (childIndex < 0) break;
      path = path * this.#arity + childIndex;
      if (depth < this.#maxDepth - 1) {
        node = node.getNthChild(childIndex);
      }
    }

    return path + 1;
  }

  get maxDepth(): number {
    return this.#maxDepth;
  }

  #arity: number;
  #hasher: Hasher<T>;

  #maxDepth: number;

  #tree: Tree<{ digest: Uint8Array; meta?: TMeta }>;

  constructor(arity: number, hasher: Hasher<T>, items?: Array<{ meta?: TMeta; value: T }>) {
    if (arity < 2) throw new Error('Arity must be greater than 1');
    this.#hasher = hasher;
    this.#arity = arity;
    this.#tree = new Tree();
    if (items === undefined || items.length === 0) {
      this.#maxDepth = 0;
      return;
    }
    this.#maxDepth = Math.ceil(Math.log(items.length) / Math.log(arity));
    let children = items.map((item) => {
      const digest = this.#hasher.hash(item.value);
      return new Tree.Node<{ digest: Uint8Array; meta?: TMeta }>({ digest, meta: item.meta });
    });
    for (let depth = 0; depth < this.#maxDepth; depth++) {
      const newChildren = new Array<Node<{ digest: Uint8Array; meta?: TMeta }>>();
      for (let i = 0; i < children.length; i += this.#arity) {
        let length = 0;
        const end = Math.min(i + this.#arity, children.length);
        for (let j = i; j < end; j++) length += children[j]!.value.digest.length;
        const buf = new Uint8Array(length);
        let off = 0;
        for (let j = i; j < end; j++) {
          buf.set(children[j]!.value.digest, off);
          off += children[j]!.value.digest.length;
        }
        const digest = byteHasher.hash(buf);
        const node = new Tree.Node({ digest });
        for (let j = i; j < end; j++) {
          const child = children[j]!;
          node.insertNode(child);
        }
        newChildren.push(node);
      }
      children = newChildren;
    }
    this.#tree.setRootNode(children[0]!);
  }

  static fromJSON<T, TMeta>(json: ReturnType<MerkleTree<T, TMeta>['toJSON']>, hasher: Hasher<T>) {
    const tree = new MerkleTree<T, TMeta>(json.arity, hasher);
    tree.#tree = json.tree === null ? new Tree() : Tree.fromJSON(json.tree);
    tree.#maxDepth = json.maxDepth;
    return tree;
  }

  static fromString<T, TMeta>(value: string, hasher: Hasher<T>) {
    return MerkleTree.fromJSON<T, TMeta>(
      JSON.parse(value, (key, value) => {
        if (key === 'digest') return new Uint8Array(value);
        return value;
      }),
      hasher
    );
  }

  getChildrenHashes(path: number[]): Uint8Array[] {
    let node = this.#tree.root;
    if (!node) return [];

    for (const index of path) {
      if (index >= node.width) return [];
      node = node.getNthChild(index);
    }

    return node.children.map((child) => child.value.digest);
  }

  getHash(path: number[]): null | Uint8Array {
    let node = this.#tree.root;
    if (!node) throw new Error('Tree is empty');
    for (const index of path) {
      if (index >= node.width) return null;
      node = node.getNthChild(index);
    }
    return node.value.digest;
  }

  getIndexByMeta(meta: TMeta, compare: (a: TMeta, b: TMeta) => number) {
    let left = 0;
    let right = this.leafCount - 1;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const currentMeta = this.getMeta(mid)!;
      const comparison = compare(currentMeta, meta);
      if (comparison === 0) {
        return mid;
      } else if (comparison < 0) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return -1;
  }

  getIndexFromPath(path: number[]): number {
    if (path.length > this.#maxDepth) return -1;
    let index = 0;
    for (let d = 0; d < this.#maxDepth; d++) {
      const childIndex = d < path.length ? path[d]! : 0;
      index = index * this.#arity + childIndex;
    }
    return index;
  }

  getMeta(index: number): null | TMeta {
    if (!Number.isInteger(index) || index < 0) return null;
    const path = [] as number[];
    for (let depth = this.#maxDepth - 1; depth >= 0; depth--) {
      const power = Math.pow(this.#arity, depth);
      path.push(Math.floor(index / power));
      index = index % power;
    }

    let node = this.#tree.root;
    if (!node) return null;
    for (const index of path) {
      if (index >= node.width) return null;
      node = node.getNthChild(index);
    }
    return node.value.meta ?? null;
  }

  getMetaByPath(path: number[]) {
    const index = this.getIndexFromPath(path);
    return this.getMeta(index);
  }

  insert(value: T, meta: TMeta) {
    const digest = this.#hasher.hash(value);

    // Phase 1: Empty tree
    if (this.#tree.root === null) {
      this.#maxDepth = 1;
      this.#tree.root = new Node({ digest });
      this.#tree.root.insert({ digest, meta });
      return;
    }

    // Phase 2: Walk down rightmost path
    const path: Node<{ digest: Uint8Array; meta?: TMeta }>[] = [];
    let node = this.#tree.root;
    for (let depth = 0; depth < this.#maxDepth; depth++) {
      path.push(node);
      if (depth < this.#maxDepth - 1) {
        node = node.getNthChild(node.width - 1)!;
      }
    }

    // Phase 3: Insert value into the tree
    const leafHasSpace = path[path.length - 1]!.width < this.#arity;
    if (leafHasSpace) {
      path[path.length - 1]!.insert({ digest, meta });
    } else {
      // Walk up rightmost path to find first non-full ancestor
      let splitIndex = -1;
      for (let i = path.length - 2; i >= 0; i--) {
        if (path[i]!.width < this.#arity) {
          splitIndex = i;
          break;
        }
      }

      const treeFull = splitIndex < 0;
      if (treeFull) {
        this.#maxDepth += 1;
        const newRoot = new Node({ digest: this.#tree.root.value.digest });
        newRoot.insertNode(this.#tree.root);
        this.#tree.root = newRoot;
        splitIndex = 0;
        path.unshift(newRoot);
      }

      // Insert a new sibling branch below path[splitIndex]
      for (let depth = splitIndex + 1; depth < this.#maxDepth; depth++) {
        const newNode = new Node({ digest: new Uint8Array(0) });
        path[depth - 1]!.insertNode(newNode);
        // Track new node for rehashing (replace old path node or append)
        if (depth < path.length) {
          path[depth] = newNode;
        } else {
          path.push(newNode);
        }
      }
      // Insert leaf data at the final depth
      path[path.length - 1]!.insert({ digest, meta });
    }

    // Phase 4: Rehash bottom-up along the affected path
    for (let i = path.length - 1; i >= 0; i--) {
      const n = path[i]!;
      let length = 0;
      for (const child of n.children) length += child.value.digest.length;
      const buf = new Uint8Array(length);
      let off = 0;
      for (const child of n.children) {
        buf.set(child.value.digest, off);
        off += child.value.digest.length;
      }
      n.value.digest = byteHasher.hash(buf);
    }
  }

  isEmpty() {
    return this.#tree.root === null;
  }

  rootDigest() {
    const node = this.#tree.root;
    if (!node) throw new Error('Tree is empty');
    return node.value.digest;
  }

  toJSON() {
    return {
      arity: this.#arity,
      leafCount: this.leafCount,
      maxDepth: this.#maxDepth,
      tree: this.#tree.toJSON()
    };
  }

  toString() {
    return JSON.stringify(this.toJSON(), (key, value) => {
      if (key === 'digest') return Array.from(value);
      return value;
    });
  }
}
