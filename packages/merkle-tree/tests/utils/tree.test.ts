import { describe, expect, it } from 'vitest';

import { Node, Tree } from '~/utils/tree';

// ---------------------------------------------------------------------------
// Helper for creating sample nodes
// ---------------------------------------------------------------------------
function createLeaf(value: number): Node<number> {
  return new Node(value);
}

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------
describe('Node', () => {
  it('creates a node with the given value and no children', () => {
    const node = new Node(42);
    expect(node.value).toBe(42);
    expect(node.children).toEqual([]);
    expect(node.width).toBe(0);
  });

  it('getNthChild returns the correct child', () => {
    const parent = new Node('root');
    const childA = parent.insert('a');
    const childB = parent.insert('b');
    expect(parent.getNthChild(0)).toBe(childA);
    expect(parent.getNthChild(1)).toBe(childB);
  });

  it('getNthChild throws for a negative index', () => {
    const parent = new Node('root');
    parent.insert('a');
    expect(() => parent.getNthChild(-1)).toThrow("child at index -1 doesn't exist");
  });

  it('getNthChild throws when index >= width', () => {
    const parent = new Node('root');
    parent.insert('a');
    expect(() => parent.getNthChild(1)).toThrow("child at index 1 doesn't exist");
  });

  it('getNthChild throws on an empty node', () => {
    const parent = new Node('root');
    expect(() => parent.getNthChild(0)).toThrow("child at index 0 doesn't exist");
  });

  it('insert creates a new child node', () => {
    const parent = new Node('parent');
    const child = parent.insert('child');
    expect(child.value).toBe('child');
    expect(parent.width).toBe(1);
    expect(parent.getNthChild(0)).toBe(child);
  });

  it('insert appends children in order', () => {
    const parent = new Node('parent');
    parent.insert('first');
    parent.insert('second');
    parent.insert('third');
    expect(parent.width).toBe(3);
    expect(parent.getNthChild(0).value).toBe('first');
    expect(parent.getNthChild(1).value).toBe('second');
    expect(parent.getNthChild(2).value).toBe('third');
  });

  it('insertNode appends an existing node reference', () => {
    const parent = new Node('parent');
    const existing = new Node('existing');
    parent.insertNode(existing);
    expect(parent.width).toBe(1);
    expect(parent.getNthChild(0)).toBe(existing);
  });

  it('remove deletes a child node by reference', () => {
    const parent = new Node('parent');
    const child1 = parent.insert('keep');
    const child2 = parent.insert('remove');
    expect(parent.width).toBe(2);
    parent.remove(child2);
    expect(parent.width).toBe(1);
    expect(parent.getNthChild(0)).toBe(child1);
  });

  it('remove throws if the node is not a child', () => {
    const parent = new Node('parent');
    const orphan = new Node('orphan');
    expect(() => parent.remove(orphan)).toThrow('Node not found');
  });

  it('toJSON serialises correctly', () => {
    const root = new Node({ label: 'root' });
    const child = root.insert({ label: 'child' });
    child.insert({ label: 'grandchild' });

    const json = root.toJSON();
    expect(json).toEqual({
      children: [
        {
          children: [{ children: [], value: { label: 'grandchild' } }],
          value: { label: 'child' }
        }
      ],
      value: { label: 'root' }
    });
  });
});

// ---------------------------------------------------------------------------
// Tree
// ---------------------------------------------------------------------------
describe('Tree', () => {
  it('creates an empty tree when no value is given', () => {
    const tree = new Tree<number>();
    expect(tree.root).toBeNull();
    expect(tree.width).toBe(-1);
  });

  it('creates a tree with a root when a value is given', () => {
    const tree = new Tree(100);
    expect(tree.root).not.toBeNull();
    expect(tree.root!.value).toBe(100);
    expect(tree.width).toBe(0);
  });

  it('getNthChild throws on an empty tree', () => {
    const tree = new Tree<number>();
    expect(() => tree.getNthChild(0)).toThrow("0th child doesn't exist");
  });

  it('insert throws on an empty tree', () => {
    const tree = new Tree<number>();
    expect(() => tree.insert(999)).toThrow('Tree is empty');
  });

  it('insert adds a child to the root', () => {
    const tree = new Tree('root');
    tree.insert('child');
    expect(tree.width).toBe(1);
    expect(tree.root!.getNthChild(0).value).toBe('child');
  });

  it('insertNode appends an existing node', () => {
    const tree = new Tree('root');
    const existing = new Node('imported');
    tree.insertNode(existing);
    expect(tree.width).toBe(1);
    expect(tree.root!.getNthChild(0)).toBe(existing);
  });

  it('insertNode throws on an empty tree', () => {
    const tree = new Tree<number>();
    expect(() => tree.insertNode(new Node(1))).toThrow('Tree is empty');
  });

  it('remove throws on an empty tree', () => {
    const tree = new Tree<number>();
    expect(() => tree.remove(new Node(1))).toThrow('Tree is empty');
  });

  it('remove removes a child from the root', () => {
    const tree = new Tree('root');
    const child = tree.insert('child');
    tree.remove(child);
    expect(tree.width).toBe(0);
  });

  it('setRoot replaces the root with a new node by value', () => {
    const tree = new Tree('old');
    tree.setRoot('new');
    expect(tree.root!.value).toBe('new');
    expect(tree.width).toBe(0);
  });

  it('setRootNode replaces the root node reference', () => {
    const tree = new Tree('old');
    const newNode = new Node('newRoot');
    tree.setRootNode(newNode);
    expect(tree.root).toBe(newNode);
  });

  it('toJSON returns null for an empty tree', () => {
    const tree = new Tree<number>();
    expect(tree.toJSON()).toBeNull();
  });

  it('toJSON returns the root JSON for a non-empty tree', () => {
    const tree = new Tree('root');
    tree.insert('child');
    const json = tree.toJSON();
    expect(json).toEqual({
      children: [{ children: [], value: 'child' }],
      value: 'root'
    });
  });

  it('fromJSON reconstructs a tree from valid JSON', () => {
    const json = {
      children: [
        {
          children: [{ children: [], value: 'grandchild' }],
          value: 'child-a'
        },
        { children: [], value: 'child-b' }
      ],
      value: 'root'
    };
    const tree = Tree.fromJSON(json);
    expect(tree.root).not.toBeNull();
    expect(tree.root!.value).toBe('root');
    expect(tree.width).toBe(2);
    expect(tree.root!.getNthChild(0).value).toBe('child-a');
    expect(tree.root!.getNthChild(1).value).toBe('child-b');
    expect(tree.root!.getNthChild(0).getNthChild(0).value).toBe('grandchild');
  });

  it('roundtrips via toJSON / fromJSON', () => {
    const original = new Tree('top');
    const midA = original.insert('mid-a');
    midA.insert('bottom');
    original.insert('mid-b');

    const json = original.toJSON();
    const restored = Tree.fromJSON(json!);
    expect(restored.root!.value).toBe('top');
    expect(restored.width).toBe(2);
    expect(restored.root!.getNthChild(0).getNthChild(0).value).toBe('bottom');
  });
});
