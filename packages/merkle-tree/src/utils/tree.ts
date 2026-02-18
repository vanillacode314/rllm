export type TJSONNode<T> = {
  children: Array<TJSONNode<T>>;
  value: T;
};

export class Node<T> {
  children: Array<Node<T>>;
  value: T;

  get width() {
    return this.children.length;
  }

  constructor(value: T) {
    this.value = value;
    this.children = [];
  }

  getNthChild(n: number) {
    if (n < 0) throw new Error(`child at index ${n} doesn't exist`);
    if (n >= this.width) throw new Error(`child at index ${n} doesn't exist`);
    return this.children[n]!;
  }

  insert(value: T) {
    const node = new Node(value);
    this.children.push(node);
    return node;
  }

  insertNode(value: Node<T>) {
    this.children.push(value);
  }

  remove(node: Node<T>) {
    const index = this.children.findIndex((child) => child === node);
    if (index === -1) throw new Error('Node not found');
    this.children.splice(index, 1);
  }

  toJSON(): TJSONNode<T> {
    return {
      children: this.children.map((child) => child.toJSON()),
      value: this.value
    };
  }

  *traverse() {
    for (const child of this.children) yield child;
  }
}

export class Tree<T> {
  static Node = Node;
  root: Node<T> | null;

  get width() {
    if (this.root === null) return -1;
    return this.root.width;
  }

  constructor(value?: T) {
    this.root = value ? new Node(value) : null;
  }

  static fromJSON<T>(json: TJSONNode<T>): Tree<T> {
    const tree = new Tree<T>();
    const root = new Node(json.value);
    tree.setRootNode(root);
    for (const child of json.children) {
      root.insertNode(Tree.fromJSON(child).root!);
    }
    return tree;
  }

  getNthChild(n: number) {
    if (this.root === null) throw new Error(`${n}th child doesn't exist`);
    return this.root.getNthChild(n);
  }

  insert(value: T) {
    if (this.root === null) throw new Error('Tree is empty');
    return this.root.insert(value);
  }

  insertNode(node: Node<T>) {
    if (this.root === null) throw new Error('Tree is empty');
    this.root.children.push(node);
  }

  remove(node: Node<T>) {
    if (this.root === null) throw new Error('Tree is empty');
    this.root.remove(node);
  }

  setRoot(value: T) {
    this.root = new Node(value);
    return this.root;
  }

  setRootNode(node: Node<T>) {
    this.root = node;
  }

  toJSON() {
    if (this.root === null) return null;
    return this.root.toJSON();
  }

  *traverse() {
    if (this.root === null) return;
    yield* this.root.traverse();
  }
}
