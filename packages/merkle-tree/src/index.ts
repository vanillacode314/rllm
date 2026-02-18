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
        const slicedChildren = children.slice(i, i + this.#arity);
        const digest = byteHasher.hash(
          concatUint8Arrays(...slicedChildren.map((node) => node.value.digest))
        );
        const node = new Tree.Node({ digest });
        for (const child of slicedChildren) {
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

    return node
      .traverse()
      .map((child) => child.value.digest)
      .toArray();
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
    let done = false;
    const digest = this.#hasher.hash(value);
    while (!done) {
      if (this.#tree.root === null) {
        this.#maxDepth += 1;
        this.#tree.root = new Tree.Node({ digest });
        this.#tree.insert({ digest, meta });
        done = true;
        return;
      }

      let node = this.#tree.root;
      const nodeStack = [{ depth: 0, node }];
      let noSpaceLeft = false;

      for (let depth = 0; depth < this.#maxDepth; depth++) {
        if (depth === this.#maxDepth - 1) {
          if (node.width === this.arity) {
            noSpaceLeft = true;
            break;
          }
          node.insert({ digest, meta });
          done = true;
        } else {
          const width = node.width;
          node = node.getNthChild(width - 1)!;
          nodeStack.push({ depth: depth + 1, node });
        }
      }

      do {
        const { depth, node } = nodeStack.pop()!;
        if (noSpaceLeft) {
          if (node.width < this.arity) {
            noSpaceLeft = false;
            done = true;
            let node2 = node;
            for (let i = 0; i < this.#maxDepth - depth; i++) {
              nodeStack.push({ depth: depth + i, node: node2 });
              if (depth + i === this.#maxDepth - 1) {
                node2.insert({ digest, meta });
              } else {
                node2.insert({ digest });
              }
              node2 = node2.getNthChild(node2.width - 1)!;
            }
          }
        } else {
          const accumulatedDigest = byteHasher.hash(
            concatUint8Arrays(...node.traverse().map((node) => node.value.digest))
          );
          node.value = { digest: accumulatedDigest };
        }
      } while (nodeStack.length > 0);

      if (noSpaceLeft) {
        noSpaceLeft = false;
        this.#maxDepth += 1;
        const newTree = new Tree<{ digest: Uint8Array; meta?: TMeta }>();
        newTree.setRoot({ digest: this.#tree.root.value.digest });
        newTree.insertNode(this.#tree.root);
        this.#tree = newTree;
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

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}
