import { Option } from 'ts-result-option';

type JsonTree<T> = {
  /** Nodes keyed by their id (the `.`-joined path from the root). */
  nodes: Record<string, JsonTreeNode<T>>;
  rootId: string;
};

type JsonTreeNode<T> = {
  childrenIds: string[];
  value: T | undefined;
};

/**
 * Nested shape of {@link JsonTree}, matching the pre-flattening layout.
 * Consumers that walk the tree positionally (following a path of child indexes,
 * e.g. the chat renderer) can expand a flat tree with {@link toNestedJsonTree}.
 */
type NestedJsonTreeNode<T> = {
  children: NestedJsonTreeNode<T>[];
  value: null | T;
};

interface TTreeNode<T> {
  addChild(child: TTreeNode<T>): TTreeNode<T>;
  readonly children: TTreeNode<T>[];
  iter(path: number[]): IteratorObject<{ node: Option<TTreeNode<T>>; path: number[] }>;
  get parent(): Option<TTreeNode<T>>;
  removeChild(index: number): TTreeNode<T>;
  removeNodeAndDescendants(path: number[]): void;
  removeParent(): TTreeNode<T>;
  setChild(index: number, child: TTreeNode<T>): TTreeNode<T>;
  setChildren(children: TTreeNode<T>[]): TTreeNode<T>;
  setParent(parent: TTreeNode<T>): TTreeNode<T>;
  setValue(value: Option<T>): TTreeNode<T>;
  toJSON(): JsonTree<T>;
  traverse(path: number[]): Option<TTreeNode<T>>;
  get value(): Option<T>;
  walk(path?: number[]): IteratorObject<{ node: TTreeNode<T>; path: number[] }>;
}

class TreeNode<T> implements TTreeNode<T> {
  _parent: Option<TTreeNode<T>> = Option.None();
  _value: Option<T> = Option.None();
  children: TTreeNode<T>[] = [];

  get parent(): Option<TTreeNode<T>> {
    return this._parent;
  }

  get value(): Option<T> {
    return this._value;
  }

  constructor(value?: T) {
    if (value !== undefined) {
      this._value = Option.Some(value);
    }
  }

  static fromJSON<T>(json: JsonTree<T>): TreeNode<T> {
    const nodes = new Map<string, TreeNode<T>>();
    for (const [id, node] of Object.entries(json.nodes)) {
      nodes.set(id, new TreeNode<T>(node.value));
    }
    for (const [id, node] of Object.entries(json.nodes)) {
      const treeNode = nodes.get(id)!;
      for (const childId of node.childrenIds) {
        treeNode.addChild(nodes.get(childId)!);
      }
    }
    return nodes.get(json.rootId)!;
  }

  addChild(child: TTreeNode<T>): this {
    this.children.push(child.setParent(this));
    return this;
  }

  iter(path: number[]): IteratorObject<{ node: Option<TTreeNode<T>>; path: number[] }> {
    return iterPath(this, path) as unknown as IteratorObject<{
      node: Option<TTreeNode<T>>;
      path: number[];
    }>;
  }

  removeChild(index: number): this {
    const [child] = this.children.splice(index, 1);
    child?.removeParent();
    return this;
  }

  removeNodeAndDescendants(path: number[]): void {
    if (path.length === 0) throw new Error("Can't remove root node!");
    const index = path[0]!;
    if (index < 0 || index >= this.children.length) {
      throw new Error(`Index ${index} out of bounds`);
    }
    if (path.length === 1) {
      const [child] = this.children.splice(index, 1);
      child?.removeParent();
      return;
    }
    this.children[index]!.removeNodeAndDescendants(path.slice(1));
  }

  removeParent(): this {
    this._parent = Option.None();
    return this;
  }

  setChild(index: number, child: TTreeNode<T>): this {
    const old = this.children[index];
    if (old) old.removeParent();
    this.children[index] = child.setParent(this);
    return this;
  }

  setChildren(children: TTreeNode<T>[]): this {
    for (const child of this.children) {
      child.removeParent();
    }
    for (const child of children) {
      child.setParent(this);
    }
    this.children = [...children];
    return this;
  }

  setParent(parent: TTreeNode<T>): this {
    this._parent = Option.Some(parent);
    return this;
  }

  setValue(value: Option<T>): this {
    this._value = value;
    return this;
  }

  toJSON(): JsonTree<T> {
    return nodeToJSON(this);
  }

  traverse(path: number[]): Option<TTreeNode<T>> {
    return traversePath(this, path);
  }

  walk(path?: number[]): IteratorObject<{ node: TTreeNode<T>; path: number[] }> {
    return walkTree(this, path) as unknown as IteratorObject<{
      node: TTreeNode<T>;
      path: number[];
    }>;
  }
}

function* iterPath<T>(
  node: TTreeNode<T>,
  path: number[]
): Generator<{ node: Option<TTreeNode<T>>; path: number[] }> {
  let current: TTreeNode<T> = node;
  for (let i = 0; i < path.length; i++) {
    const index = path[i]!;
    const currentPath = path.slice(0, i + 1);
    if (index < 0 || index >= current.children.length) {
      yield { node: Option.None(), path: currentPath };
      return;
    }
    current = current.children[index]!;
    yield { node: Option.Some(current), path: currentPath };
  }
}

function nodeToJSON<T>(node: TTreeNode<T>): JsonTree<T> {
  const nodes: Record<string, JsonTreeNode<T>> = {};
  for (const { node: n, path } of node.walk()) {
    nodes[path.join('.')] = {
      childrenIds: n.children.map((_, i) => [...path, i].join('.')),
      value: n.value.toUndefined()
    };
  }
  return { nodes, rootId: '' };
}

/**
 * Inverse of {@link toNestedJsonTree}: flattens a legacy nested tree into the
 * current {@link JsonTree} shape. Used to migrate persisted/exported data that
 * was written before the flat format was introduced.
 */
function toFlatJsonTree<T>(node: NestedJsonTreeNode<T>): JsonTree<T> {
  const nodes: Record<string, JsonTreeNode<T>> = {};
  const build = (current: NestedJsonTreeNode<T>, path: number[]): void => {
    nodes[path.join('.')] = {
      childrenIds: current.children.map((_, index) => [...path, index].join('.')),
      value: current.value ?? undefined
    };
    current.children.forEach((child, index) => build(child, [...path, index]));
  };
  build(node, []);
  return { nodes, rootId: '' };
}

function toNestedJsonTree<T>(json: JsonTree<T>): NestedJsonTreeNode<T> {
  const build = (id: string): NestedJsonTreeNode<T> => {
    const node = json.nodes[id]!;
    return {
      children: node.childrenIds.map((childId) => build(childId)),
      value: node.value ?? null
    };
  };
  return build(json.rootId);
}

function traversePath<T>(node: TTreeNode<T>, path: number[]): Option<TTreeNode<T>> {
  let current: TTreeNode<T> = node;
  for (const index of path) {
    if (index < 0 || index >= current.children.length) {
      return Option.None();
    }
    current = current.children[index]!;
  }
  return Option.Some(current);
}

function* walkTree<T>(
  node: TTreeNode<T>,
  path: number[] = []
): Generator<{ node: TTreeNode<T>; path: number[] }> {
  yield { node, path };
  for (let i = 0; i < node.children.length; i++) {
    yield* walkTree(node.children[i]!, [...path, i]);
  }
}

export {
  type JsonTree,
  type NestedJsonTreeNode,
  toFlatJsonTree,
  toNestedJsonTree,
  TreeNode as Tree,
  TreeNode,
  type TTreeNode as TTree,
  type TTreeNode
};
