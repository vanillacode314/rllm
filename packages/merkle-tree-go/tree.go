package merkletree

import (
	"errors"
	"fmt"
)

// Sentinel errors returned by Node and Tree operations.
var (
	errNodeNotFound = errors.New("Node not found")
	errTreeIsEmpty  = errors.New("Tree is empty")
)

// Node is a generic tree node holding a value and an ordered list of children.
type Node[T any] struct {
	// Value is the value stored in this node.
	Value T
	// Children are the node's children, in order.
	Children []*Node[T]
}

// NewNode returns a node holding value with no children.
func NewNode[T any](value T) *Node[T] {
	return &Node[T]{Value: value}
}

// Width returns the number of children.
func (n *Node[T]) Width() int {
	return len(n.Children)
}

// GetNthChild returns the child at index i, or an error when i is out of
// bounds.
func (n *Node[T]) GetNthChild(i int) (*Node[T], error) {
	if i < 0 || i >= len(n.Children) {
		return nil, fmt.Errorf("child at index %d doesn't exist", i)
	}
	return n.Children[i], nil
}

// Insert appends a new child holding value and returns it.
func (n *Node[T]) Insert(value T) *Node[T] {
	node := NewNode(value)
	n.Children = append(n.Children, node)
	return node
}

// InsertNode appends an existing node as a child.
func (n *Node[T]) InsertNode(node *Node[T]) {
	n.Children = append(n.Children, node)
}

// Remove removes node from the children, returning an error when it is not a
// child of this node.
func (n *Node[T]) Remove(node *Node[T]) error {
	for i, child := range n.Children {
		if child == node {
			n.Children = append(n.Children[:i], n.Children[i+1:]...)
			return nil
		}
	}
	return errNodeNotFound
}

// Tree is a generic tree with a single root node.
type Tree[T any] struct {
	// Root is the root node, or nil for an empty tree.
	Root *Node[T]
}

// NewTree returns an empty tree.
func NewTree[T any]() *Tree[T] {
	return &Tree[T]{}
}

// NewTreeWithRoot returns a tree whose root holds value.
func NewTreeWithRoot[T any](value T) *Tree[T] {
	return &Tree[T]{Root: NewNode(value)}
}

// Width returns the width of the root node, or -1 for an empty tree.
func (t *Tree[T]) Width() int {
	if t.Root == nil {
		return -1
	}
	return t.Root.Width()
}

// GetNthChild returns the root's i-th child.
func (t *Tree[T]) GetNthChild(i int) (*Node[T], error) {
	if t.Root == nil {
		return nil, fmt.Errorf("%dth child doesn't exist", i)
	}
	return t.Root.GetNthChild(i)
}

// Insert appends a child holding value to the root.
func (t *Tree[T]) Insert(value T) (*Node[T], error) {
	if t.Root == nil {
		return nil, errTreeIsEmpty
	}
	return t.Root.Insert(value), nil
}

// InsertNode appends an existing node to the root's children.
func (t *Tree[T]) InsertNode(node *Node[T]) error {
	if t.Root == nil {
		return errTreeIsEmpty
	}
	t.Root.InsertNode(node)
	return nil
}

// Remove removes node from the root's children.
func (t *Tree[T]) Remove(node *Node[T]) error {
	if t.Root == nil {
		return errTreeIsEmpty
	}
	return t.Root.Remove(node)
}

// SetRoot replaces the root with a new node holding value and returns it.
func (t *Tree[T]) SetRoot(value T) *Node[T] {
	t.Root = NewNode(value)
	return t.Root
}

// SetRootNode replaces the root node.
func (t *Tree[T]) SetRootNode(node *Node[T]) {
	t.Root = node
}
