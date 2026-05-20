import { sha3_256 } from 'js-sha3';

import { round } from './utils/math';
import { Node, Tree } from './utils/tree';

export interface Hasher<T> {
  hash(value: T): Uint8Array;
}

const LOG_PRECISION_FOR_DEPTH_CALCULATIONS = 3;

export const byteHasher: Hasher<Uint8Array> = {
  hash(value: Uint8Array): Uint8Array {
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
    return this.#leafCount;
  }
  get maxDepth(): number {
    return this.#maxDepth;
  }

  #arity: number;
  #hasher: Hasher<T>;
  #leafCount: number;
  #leafMetaCache: TMeta[] = [];
  #maxDepth: number;

  #tree: Tree<{ digest: Uint8Array; meta?: TMeta }>;

  constructor(arity: number, hasher: Hasher<T>, items?: Array<{ meta: TMeta; value: T }>) {
    if (arity < 2) throw new Error('Arity must be greater than 1');
    this.#leafCount = items?.length ?? 0;
    this.#hasher = hasher;
    this.#arity = arity;
    this.#tree = new Tree();
    this.#maxDepth = 0;

    if (items === undefined || items.length === 0) return;

    this.#leafMetaCache = items.map((item) => item.meta);

    if (items.length === 1) {
      this.#leafCount = 0;
      this.insert(items);
      return;
    }
    this.#maxDepth = Math.ceil(
      round(Math.log(items.length) / Math.log(arity), LOG_PRECISION_FOR_DEPTH_CALCULATIONS)
    );
    let children = items.map((item) => {
      const digest = this.#hasher.hash(item.value);
      return new Tree.Node<{ digest: Uint8Array; meta?: TMeta }>({ digest, meta: item.meta });
    });

    for (let depth = 0; depth < this.#maxDepth; depth++) {
      const newChildren = new Array<Node<{ digest: Uint8Array; meta?: TMeta }>>();
      for (let i = 0; i < children.length; i += this.#arity) {
        const end = Math.min(i + this.#arity, children.length);
        const hasher = sha3_256.create();

        for (let j = i; j < end; j++) hasher.update(children[j]!.value.digest);
        const digest = new Uint8Array<ArrayBufferLike>(hasher.arrayBuffer());
        const node = new Tree.Node({ digest });

        for (let j = i; j < end; j++) {
          node.insertNode(children[j]!);
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
    tree.#leafCount = json.leafCount;
    tree.#maxDepth = json.maxDepth;
    tree.#rebuildMetaCache();
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
    let right = this.#leafCount - 1;
    while (left <= right) {
      const mid = (left + right) >> 1;
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
    if (!Number.isInteger(index) || index < 0 || index >= this.#leafCount) return null;
    return this.#leafMetaCache[index] ?? null;
  }

  getMetaByPath(path: number[]) {
    const index = this.getIndexFromPath(path);
    return this.getMeta(index);
  }

  insert(values: Array<{ meta: TMeta; value: T }>) {
    if (values.length === 0) return;
    this.#leafCount += values.length;

    const depthExpansion =
      Math.ceil(
        round(
          Math.log(values.length + 1) / Math.log(this.#arity),
          LOG_PRECISION_FOR_DEPTH_CALCULATIONS
        )
      ) + 2;
    const estimatedMaxDepth = this.#maxDepth + depthExpansion;
    const dirtyNodesByHeight: Set<Node<{ digest: Uint8Array; meta?: TMeta }>>[] = Array.from(
      { length: estimatedMaxDepth },
      () => new Set()
    );

    const path: Node<{ digest: Uint8Array; meta?: TMeta }>[] = [];

    for (const { meta, value } of values) {
      this.#leafMetaCache.push(meta);
      const digest = this.#hasher.hash(value);

      // Phase 1: Empty tree
      if (this.#tree.root === null) {
        this.#maxDepth = 1;
        const rootDigest = byteHasher.hash(digest);

        this.#tree.root = new Node({ digest: rootDigest });
        this.#tree.root.insert({ digest, meta });
        dirtyNodesByHeight[0]!.add(this.#tree.root);
        continue;
      }

      // Phase 2: Walk down rightmost path
      path.length = 0;
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

        for (let depth = splitIndex + 1; depth < this.#maxDepth; depth++) {
          const newNode = new Node({ digest: new Uint8Array(0) });
          path[depth - 1]!.insertNode(newNode);
          if (depth < path.length) {
            path[depth] = newNode;
          } else {
            path.push(newNode);
          }
        }
        path[path.length - 1]!.insert({ digest, meta });
      }

      for (let i = 0; i < path.length; i++) {
        dirtyNodesByHeight[path.length - 1 - i]!.add(path[i]!);
      }
    }

    // Phase 4: Rehash bottom-up along the affected path
    for (let height = 0; height < this.#maxDepth; height++) {
      for (const node of dirtyNodesByHeight[height]!) {
        const hasher = sha3_256.create();
        for (const child of node.children) hasher.update(child.value.digest);
        node.value.digest = new Uint8Array(hasher.arrayBuffer());
      }
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
      leafCount: this.#leafCount,
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

  #rebuildMetaCache() {
    const root = this.#tree.root;
    if (!root) {
      this.#leafMetaCache = [];
      return;
    }
    const leaves: TMeta[] = [];
    const collect = (node: Node<{ meta?: TMeta }>, currentDepth: number) => {
      if (!node) return;
      if (currentDepth === this.#maxDepth) {
        leaves.push(node.value.meta!);
        return;
      }
      for (let i = 0; i < node.width; i++) {
        collect(node.getNthChild(i), currentDepth + 1);
      }
    };
    collect(root, 0);
    this.#leafMetaCache = leaves;
  }
}
