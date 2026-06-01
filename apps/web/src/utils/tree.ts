import { createSignal } from 'solid-js';
import { createMutable, unwrap } from 'solid-js/store';
import { Option } from 'ts-result-option';

type JsonTreeNode<T> = {
  children: JsonTreeNode<T>[];
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
  toJSON(): JsonTreeNode<T>;
  traverse(path: number[]): Option<TTreeNode<T>>;
  get value(): Option<T>;
  walk(path?: number[]): IteratorObject<{ node: TTreeNode<T>; path: number[] }>;
}

class ReactiveTreeNode<T> implements TTreeNode<T> {
  children: TTreeNode<T>[] = createMutable([]);
  get parent(): Option<TTreeNode<T>> {
    return this.#parentSignal[0]();
  }

  get value(): Option<T> {
    return this.#valueSignal[0]();
  }

  #parentSignal = createSignal(Option.None<TTreeNode<T>>());
  #valueSignal = createSignal(Option.None<T>());

  constructor(value?: T) {
    if (value !== undefined) {
      this.#valueSignal[1](Option.Some(value));
    }
  }

  static fromJSON<T>(json: JsonTreeNode<T>): ReactiveTreeNode<T> {
    const children = json.children.map((child) => ReactiveTreeNode.fromJSON(child));
    const tree = new ReactiveTreeNode<T>();
    tree.#valueSignal[1](Option.fromNull(json.value));
    for (const child of children) {
      child.#parentSignal[1](Option.Some(tree));
    }
    tree.children.length = 0;
    tree.children.push(...children);
    return tree;
  }

  static fromTree<T>(tree: TTreeNode<T>): ReactiveTreeNode<T> {
    const children = tree.children.map((child) => ReactiveTreeNode.fromTree(child));
    const reactive = new ReactiveTreeNode<T>();
    reactive.setValue(tree.value);
    for (const child of children) {
      child.#parentSignal[1](Option.Some(reactive));
    }
    reactive.children.length = 0;
    reactive.children.push(...children);
    return reactive;
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
    this.#parentSignal[1](Option.None());
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
    this.children.length = 0;
    this.children.push(...children);
    return this;
  }

  setParent(parent: TTreeNode<T>): this {
    this.#parentSignal[1](Option.Some(parent));
    return this;
  }

  setValue(value: Option<T>): this {
    if (value.isSomeAnd((v) => typeof v === 'object' && v !== null)) {
      this.#valueSignal[1](value.map((v) => createMutable(v)));
    } else {
      this.#valueSignal[1](value);
    }
    return this;
  }

  toJSON(): JsonTreeNode<T> {
    return nodeToJSON(unwrap(this));
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

  static fromJSON<T>(json: JsonTreeNode<T>): TreeNode<T> {
    const children = json.children.map((child) => TreeNode.fromJSON(child));
    const tree = new TreeNode<T>();
    tree._value = Option.fromNull(json.value);
    for (const child of children) {
      child._parent = Option.Some(tree);
    }
    tree.children = children;
    return tree;
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

  toJSON(): JsonTreeNode<T> {
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

function nodeToJSON<T>(node: TTreeNode<T>): JsonTreeNode<T> {
  return {
    value: node.value.toNull(),
    children: node.children.map((child) => nodeToJSON(child))
  };
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
  for (let i = 0; i < node.children.length; i++) {
    yield* walkTree(node.children[i]!, [...path, i]);
  }
  yield { node, path };
}

export {
  type JsonTreeNode as JsonTree,
  type JsonTreeNode,
  ReactiveTreeNode as ReactiveTree,
  ReactiveTreeNode,
  TreeNode as Tree,
  TreeNode,
  type TTreeNode as TTree,
  type TTreeNode
};
