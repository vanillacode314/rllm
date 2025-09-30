import { createSignal, type Signal } from 'solid-js'
import { createMutable } from 'solid-js/store'
import { Option } from 'ts-result-option'

type JsonTreeNode<T> = {
  children: JsonTreeNode<T>[]
  value: null | T
}
class TreeNode<T> {
  children: TreeNode<T>[] = []
  get parent() {
    return this.#parent
  }
  get value() {
    return this.#value
  }

  #parent: Option<TreeNode<T>> = Option.None()
  #value: Option<T> = Option.None()

  constructor() {}
  static fromJSON<T>(json: JsonTreeNode<T>): TreeNode<T> {
    const tree = new TreeNode<T>()
    tree.setValue(Option.fromNull(json.value))
    const children = json.children.map((child) => TreeNode.fromJSON(child))
    for (const child of children) {
      child.setParent(tree)
    }
    tree.setChildren(children)
    return tree
  }
  addChild(child: T): TreeNode<T>
  addChild(child: TreeNode<T>): TreeNode<T>
  addChild(child: T | TreeNode<T>): TreeNode<T> {
    if (child instanceof TreeNode) {
      this.children.push(child.setParent(this))
    } else {
      this.children.push(new TreeNode<T>().setValue(child).setParent(this))
    }
    return this
  }
  clone(): TreeNode<T> {
    const clone = new TreeNode<T>()
    this.#value.inspect((value) => clone.setValue(value))
    this.#parent.inspect((parent) => clone.setParent(parent))
    clone.setChildren(this.children.map((child) => child.clone()))
    return clone
  }
  copy(): TreeNode<T> {
    const copy = new TreeNode<T>()
    this.#value.inspect((value) => copy.setValue(value))
    this.#parent.inspect((parent) => copy.setParent(parent))
    copy.setChildren(this.children)
    return copy
  }
  removeChild(child: TreeNode<T>) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i] === child) {
        const [c] = this.children.splice(i, 1)
        c.removeParent()
        return this
      }
    }
    return this
  }
  removeParent() {
    this.#parent = Option.None()
    return this
  }
  setChild(index: number, child: T): TreeNode<T>
  setChild(index: number, child: TreeNode<T>): TreeNode<T>
  setChild(index: number, child: T | TreeNode<T>): TreeNode<T> {
    if (child instanceof TreeNode) {
      this.children[index] = child.setParent(this)
    } else {
      this.children[index] = new TreeNode<T>().setValue(child).setParent(this)
    }
    return this
  }
  setChildren(children: T[]): TreeNode<T>
  setChildren(children: TreeNode<T>[]): TreeNode<T>
  setChildren(children: T[] | TreeNode<T>[]): TreeNode<T> {
    if (children[0] instanceof TreeNode) {
      this.children = children.map((child) =>
        (child as TreeNode<T>).setParent(this),
      )
    } else {
      this.children = (children as T[]).map((child) =>
        new TreeNode<T>().setValue(child).setParent(this),
      )
    }
    return this
  }
  setParent(parent: TreeNode<T>) {
    this.#parent = Option.Some(parent)
    return this
  }
  setValue(value: T): this
  setValue(value: Option<T>): this
  setValue(value: Option<T> | T): this {
    if (Option.isOption(value)) {
      this.#value = value
    } else {
      this.#value = Option.Some(value)
    }
    return this
  }
  toJSON(): JsonTreeNode<T> {
    return {
      value: this.#value.toNull(),
      children: this.children.map((child) => child.toJSON()),
    }
  }
}
class ReactiveTreeNode<T> extends TreeNode<T> {
  children: TreeNode<T>[] = createMutable([])
  get parent() {
    return this.#parent[0]()
  }
  get value() {
    return this.#value[0]()
  }

  #parent: Signal<Option<TreeNode<T>>> = createSignal(Option.None())
  #value: Signal<Option<T>> = createSignal(Option.None())

  constructor() {
    super()
  }
  static fromJSON<T>(json: JsonTreeNode<T>): ReactiveTreeNode<T> {
    const tree = new ReactiveTreeNode<T>()
    tree.setValue(Option.fromNull(json.value))
    const children = json.children.map((child) =>
      ReactiveTreeNode.fromJSON(child),
    )
    for (const child of children) {
      child.setParent(tree)
    }
    tree.setChildren(children)
    return tree
  }
  addChild(child: T): ReactiveTreeNode<T>
  addChild(child: TreeNode<T>): ReactiveTreeNode<T>
  addChild(child: T | TreeNode<T>): ReactiveTreeNode<T> {
    if (child instanceof TreeNode) {
      this.children.push(child.setParent(this))
    } else {
      this.children.push(
        new ReactiveTreeNode<T>().setValue(child).setParent(this),
      )
    }
    return this
  }
  clone(): ReactiveTreeNode<T> {
    const clone = new ReactiveTreeNode<T>()
    this.value.inspect((value) => clone.setValue(value))
    this.parent.inspect((parent) => clone.setParent(parent))
    clone.setChildren(this.children.map((child) => child.clone()))
    return clone
  }
  copy(): ReactiveTreeNode<T> {
    const copy = new ReactiveTreeNode<T>()
    this.value.inspect((value) => copy.setValue(value))
    this.parent.inspect((parent) => copy.setParent(parent))
    copy.setChildren(this.children)
    return copy
  }
  removeChild(child: TreeNode<T>) {
    for (let i = this.children.length - 1; i >= 0; i--) {
      if (this.children[i] === child) {
        const [c] = this.children.splice(i, 1)
        c.removeParent()
        return this
      }
    }
    return this
  }
  removeParent() {
    this.#parent[1](Option.None<TreeNode<T>>())
    return this
  }
  setChild(index: number, child: T): ReactiveTreeNode<T>
  setChild(index: number, child: TreeNode<T>): ReactiveTreeNode<T>
  setChild(index: number, child: T | TreeNode<T>): ReactiveTreeNode<T> {
    if (child instanceof TreeNode) {
      this.children[index] = child.setParent(this)
    } else {
      this.children[index] = new ReactiveTreeNode<T>()
        .setValue(child)
        .setParent(this)
    }
    return this
  }
  setChildren(children: T[]): ReactiveTreeNode<T>
  setChildren(children: TreeNode<T>[]): ReactiveTreeNode<T>
  setChildren(children: T[] | TreeNode<T>[]): ReactiveTreeNode<T> {
    if (children[0] instanceof TreeNode) {
      this.children = children.map((child) =>
        (child as TreeNode<T>).setParent(this),
      )
    } else {
      this.children = (children as T[]).map((child) =>
        new ReactiveTreeNode<T>().setValue(child).setParent(this),
      )
    }
    return this
  }
  setParent(parent: TreeNode<T>) {
    this.#parent[1](Option.Some(parent))
    return this
  }
  setValue(value: T): this
  setValue(value: Option<T>): this
  setValue(value: Option<T> | T): this {
    if (Option.isOption(value)) {
      this.#value[1](value)
    } else {
      this.#value[1](Option.Some(value))
    }
    return this
  }
  toJSON(): JsonTreeNode<T> {
    return {
      value: this.value.toNull(),
      children: this.children.map((child) => child.toJSON()),
    }
  }
}

export {
  type JsonTreeNode as JsonTree,
  type JsonTreeNode,
  ReactiveTreeNode as ReactiveTree,
  ReactiveTreeNode,
  TreeNode as Tree,
  TreeNode,
}
