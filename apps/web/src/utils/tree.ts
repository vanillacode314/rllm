import { createSignal } from 'solid-js';
import { createMutable } from 'solid-js/store';
import { Option } from 'ts-result-option';

type JsonTreeNode<T> = {
	children: JsonTreeNode<T>[];
	value: null | T;
};
interface TTreeNode<T> {
	addChild(child: TTreeNode<T>): TTreeNode<T>;
	children: TTreeNode<T>[];
	iter(path: number[]): IteratorObject<{ node: Option<TTreeNode<T>>; path: number[] }>;
	get parent(): Option<TTreeNode<T>>;
	removeChild(index: number): TTreeNode<T>;
	removeParent(): TTreeNode<T>;
	setChild(index: number, child: TTreeNode<T>): TTreeNode<T>;
	setChildren(children: TTreeNode<T>[]): TTreeNode<T>;
	setParent(parent: TTreeNode<T>): TTreeNode<T>;
	setValue(value: Option<T>): TTreeNode<T>;
	toJSON(): JsonTreeNode<T>;
	traverse(path: number[]): Option<TTreeNode<T>>;
	get value(): Option<T>;
}

class TreeNode<const T> implements TTreeNode<T> {
	children: TTreeNode<T>[] = [];
	get parent() {
		return this._parent;
	}
	get value() {
		return this._value;
	}

	protected _parent: Option<TTreeNode<T>> = Option.None();
	protected _value: Option<T> = Option.None();

	constructor(value?: T) {
		if (value) this.setValue(Option.Some(value));
	}
	static fromJSON<T>(json: JsonTreeNode<T>): TTreeNode<T> {
		const tree = new this<T>();
		tree.setValue(Option.fromNull(json.value));
		const children = json.children.map((child) => this.fromJSON(child));
		for (const child of children) {
			child.setParent(tree);
		}
		tree.setChildren(children);
		return tree;
	}
	addChild(child: TTreeNode<T>): TTreeNode<T> {
		this.children.push(child.setParent(this));
		return this;
	}
	*iter(path: number[]): IteratorObject<{ node: Option<TTreeNode<T>>; path: number[] }> {
		let node = this as TTreeNode<T>;
		for (const [index, pathIndex] of path.entries()) {
			const currentPath = path.slice(0, index + 1);
			if (pathIndex < 0 || pathIndex >= node.children.length) {
				yield {
					node: Option.None(),
					path: currentPath
				};
				return;
			}
			node = node.children[pathIndex];
			yield {
				node: Option.Some(node),
				path: currentPath
			};
		}
	}
	removeChild(index: number) {
		const [child] = this.children.splice(index, 1);
		child.removeParent();
		return this;
	}
	removeParent() {
		this._parent = Option.None();
		return this;
	}
	setChild(index: number, child: TTreeNode<T>): TTreeNode<T> {
		this.children[index] = child.setParent(this);
		return this;
	}
	setChildren(children: TTreeNode<T>[]): TTreeNode<T> {
		for (const child of children) {
			child.setParent(this);
		}
		this.children = children;
		return this;
	}
	setParent(parent: TTreeNode<T>) {
		this._parent = Option.Some(parent);
		return this;
	}
	setValue(value: Option<T>) {
		this._value = value;
		return this;
	}
	toJSON(): JsonTreeNode<T> {
		return {
			value: this.value.toNull(),
			children: this.children.map((child) => child.toJSON())
		};
	}
	traverse(path: number[]): Option<TTreeNode<T>> {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		let node: TTreeNode<T> = this;
		for (const index of path) {
			if (index < 0) throw new Error('Index must be positive');
			if (index >= node.children.length) {
				return Option.None();
			}
			node = node.children[index];
		}
		return Option.Some(node);
	}
}

class ReactiveTreeNode<const T> extends TreeNode<T> {
	children: TTreeNode<T>[] = createMutable([]);
	get parent() {
		return this._parentSignal[0]();
	}
	get value() {
		return this._valueSignal[0]();
	}

	protected _parentSignal = createSignal(Option.None<TTreeNode<T>>());
	protected _valueSignal = createSignal(Option.None<T>());

	constructor(value?: T) {
		super();
		if (value) this.setValue(Option.Some(value));
	}
	removeParent() {
		this._parentSignal[1](Option.None<TreeNode<T>>());
		return this;
	}
	setParent(parent: TTreeNode<T>) {
		this._parentSignal[1](Option.Some(parent));
		return this;
	}
	setValue(value: Option<T>) {
		if (value.isSomeAnd((value) => typeof value === 'object' && value !== null)) {
			this._valueSignal[1](value.map((v) => createMutable(v)));
		} else {
			this._valueSignal[1](value);
		}
		return this;
	}
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
