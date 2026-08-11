package merkletree

import (
	"errors"
	"testing"
)

func TestNodeBasic(t *testing.T) {
	node := NewNode(42)
	if node.Value != 42 {
		t.Errorf("Value = %v, want 42", node.Value)
	}
	if node.Width() != 0 {
		t.Errorf("Width = %d, want 0", node.Width())
	}
	if len(node.Children) != 0 {
		t.Errorf("Children = %v, want empty", node.Children)
	}
}

func TestNodeGetNthChild(t *testing.T) {
	parent := NewNode("root")
	childA := parent.Insert("a")
	childB := parent.Insert("b")
	a, err := parent.GetNthChild(0)
	if err != nil {
		t.Fatal(err)
	}
	b, err := parent.GetNthChild(1)
	if err != nil {
		t.Fatal(err)
	}
	if a != childA {
		t.Error("GetNthChild(0) != first inserted child")
	}
	if b != childB {
		t.Error("GetNthChild(1) != second inserted child")
	}
}

func TestNodeGetNthChildNegative(t *testing.T) {
	parent := NewNode("root")
	parent.Insert("a")
	_, err := parent.GetNthChild(-1)
	if err == nil || err.Error() != "child at index -1 doesn't exist" {
		t.Fatalf("err = %v, want %q", err, "child at index -1 doesn't exist")
	}
}

func TestNodeGetNthChildOutOfRange(t *testing.T) {
	parent := NewNode("root")
	parent.Insert("a")
	_, err := parent.GetNthChild(1)
	if err == nil || err.Error() != "child at index 1 doesn't exist" {
		t.Fatalf("err = %v, want %q", err, "child at index 1 doesn't exist")
	}
}

func TestNodeGetNthChildEmpty(t *testing.T) {
	parent := NewNode("root")
	_, err := parent.GetNthChild(0)
	if err == nil || err.Error() != "child at index 0 doesn't exist" {
		t.Fatalf("err = %v, want %q", err, "child at index 0 doesn't exist")
	}
}

func TestNodeInsert(t *testing.T) {
	parent := NewNode("parent")
	child := parent.Insert("child")
	if child.Value != "child" {
		t.Errorf("child.Value = %v, want child", child.Value)
	}
	if parent.Width() != 1 {
		t.Errorf("Width = %d, want 1", parent.Width())
	}
	got, err := parent.GetNthChild(0)
	if err != nil {
		t.Fatal(err)
	}
	if got != child {
		t.Error("GetNthChild(0) != inserted child")
	}
}

func TestNodeInsertOrder(t *testing.T) {
	parent := NewNode("parent")
	parent.Insert("first")
	parent.Insert("second")
	parent.Insert("third")
	if parent.Width() != 3 {
		t.Fatalf("Width = %d, want 3", parent.Width())
	}
	for i, want := range []string{"first", "second", "third"} {
		child, err := parent.GetNthChild(i)
		if err != nil {
			t.Fatal(err)
		}
		if child.Value != want {
			t.Errorf("child %d Value = %v, want %v", i, child.Value, want)
		}
	}
}

func TestNodeInsertNode(t *testing.T) {
	parent := NewNode("parent")
	existing := NewNode("existing")
	parent.InsertNode(existing)
	if parent.Width() != 1 {
		t.Errorf("Width = %d, want 1", parent.Width())
	}
	got, err := parent.GetNthChild(0)
	if err != nil {
		t.Fatal(err)
	}
	if got != existing {
		t.Error("GetNthChild(0) != appended node")
	}
}

func TestNodeRemove(t *testing.T) {
	parent := NewNode("parent")
	child1 := parent.Insert("keep")
	child2 := parent.Insert("remove")
	if parent.Width() != 2 {
		t.Fatalf("Width = %d, want 2", parent.Width())
	}
	if err := parent.Remove(child2); err != nil {
		t.Fatal(err)
	}
	if parent.Width() != 1 {
		t.Errorf("Width = %d, want 1", parent.Width())
	}
	got, err := parent.GetNthChild(0)
	if err != nil {
		t.Fatal(err)
	}
	if got != child1 {
		t.Error("remaining child != child1")
	}
}

func TestNodeRemoveNotFound(t *testing.T) {
	parent := NewNode("parent")
	orphan := NewNode("orphan")
	if err := parent.Remove(orphan); err == nil || !errors.Is(err, errNodeNotFound) {
		t.Fatalf("err = %v, want Node not found", err)
	}
}

func TestTreeEmpty(t *testing.T) {
	tree := NewTree[int]()
	if tree.Root != nil {
		t.Error("Root != nil for empty tree")
	}
	if tree.Width() != -1 {
		t.Errorf("Width = %d, want -1", tree.Width())
	}
}

func TestTreeWithRoot(t *testing.T) {
	tree := NewTreeWithRoot(100)
	if tree.Root == nil {
		t.Fatal("Root == nil")
	}
	if tree.Root.Value != 100 {
		t.Errorf("Root.Value = %v, want 100", tree.Root.Value)
	}
	if tree.Width() != 0 {
		t.Errorf("Width = %d, want 0", tree.Width())
	}
}

func TestTreeGetNthChildEmpty(t *testing.T) {
	tree := NewTree[int]()
	_, err := tree.GetNthChild(0)
	if err == nil || err.Error() != "0th child doesn't exist" {
		t.Fatalf("err = %v, want %q", err, "0th child doesn't exist")
	}
}

func TestTreeInsertEmpty(t *testing.T) {
	tree := NewTree[int]()
	if _, err := tree.Insert(999); err == nil || !errors.Is(err, errTreeIsEmpty) {
		t.Fatalf("err = %v, want Tree is empty", err)
	}
}

func TestTreeInsert(t *testing.T) {
	tree := NewTreeWithRoot("root")
	if _, err := tree.Insert("child"); err != nil {
		t.Fatal(err)
	}
	if tree.Width() != 1 {
		t.Errorf("Width = %d, want 1", tree.Width())
	}
	child, err := tree.Root.GetNthChild(0)
	if err != nil {
		t.Fatal(err)
	}
	if child.Value != "child" {
		t.Errorf("child.Value = %v, want child", child.Value)
	}
}

func TestTreeInsertNode(t *testing.T) {
	tree := NewTreeWithRoot("root")
	existing := NewNode("imported")
	if err := tree.InsertNode(existing); err != nil {
		t.Fatal(err)
	}
	if tree.Width() != 1 {
		t.Errorf("Width = %d, want 1", tree.Width())
	}
	got, err := tree.Root.GetNthChild(0)
	if err != nil {
		t.Fatal(err)
	}
	if got != existing {
		t.Error("GetNthChild(0) != appended node")
	}
}

func TestTreeInsertNodeEmpty(t *testing.T) {
	tree := NewTree[int]()
	if err := tree.InsertNode(NewNode(1)); err == nil || !errors.Is(err, errTreeIsEmpty) {
		t.Fatalf("err = %v, want Tree is empty", err)
	}
}

func TestTreeRemoveEmpty(t *testing.T) {
	tree := NewTree[int]()
	if err := tree.Remove(NewNode(1)); err == nil || !errors.Is(err, errTreeIsEmpty) {
		t.Fatalf("err = %v, want Tree is empty", err)
	}
}

func TestTreeRemove(t *testing.T) {
	tree := NewTreeWithRoot("root")
	child, err := tree.Insert("child")
	if err != nil {
		t.Fatal(err)
	}
	if err := tree.Remove(child); err != nil {
		t.Fatal(err)
	}
	if tree.Width() != 0 {
		t.Errorf("Width = %d, want 0", tree.Width())
	}
}

func TestTreeSetRoot(t *testing.T) {
	tree := NewTreeWithRoot("old")
	tree.SetRoot("new")
	if tree.Root == nil || tree.Root.Value != "new" {
		t.Errorf("Root = %v, want new", tree.Root)
	}
	if tree.Width() != 0 {
		t.Errorf("Width = %d, want 0", tree.Width())
	}
}

func TestTreeSetRootNode(t *testing.T) {
	tree := NewTreeWithRoot("old")
	newNode := NewNode("newRoot")
	tree.SetRootNode(newNode)
	if tree.Root != newNode {
		t.Error("Root != newNode")
	}
}
