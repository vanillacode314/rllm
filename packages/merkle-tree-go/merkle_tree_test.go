package merkletree

import (
	"bytes"
	"errors"
	"fmt"
	"strings"
	"testing"
)

// ---------------------------------------------------------------------------
// Deterministic mock hasher for predictable assertions
// ---------------------------------------------------------------------------

// mockHasher mirrors the reference test hasher: deterministic output based on
// input length and a per-hasher call counter, and records every input.
type mockHasher struct {
	calls   [][]byte
	counter int
}

func newMockHasher() *mockHasher {
	return &mockHasher{counter: 1}
}

func (m *mockHasher) Hash(value []byte) []byte {
	m.calls = append(m.calls, value)
	out := make([]byte, 32)
	out[0] = byte(len(value))
	out[1] = byte(m.counter)
	m.counter++
	return out
}

// =========================================================================
// Constructor
// =========================================================================

func TestNewMerkleTreeRejectsArityBelowTwo(t *testing.T) {
	for _, arity := range []int{1, 0, -1} {
		if _, err := NewMerkleTree[[]byte, string](arity, newMockHasher()); !errors.Is(err, ErrArity) {
			t.Errorf("arity %d: err = %v, want ErrArity", arity, err)
		}
	}
}

func TestNewMerkleTreeEmptyTree(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if !tree.IsEmpty() {
		t.Error("expected empty tree")
	}
	if tree.LeafCount() != 0 {
		t.Errorf("LeafCount = %d, want 0", tree.LeafCount())
	}
	if tree.MaxDepth() != 0 {
		t.Errorf("MaxDepth = %d, want 0", tree.MaxDepth())
	}
	if tree.Arity() != 2 {
		t.Errorf("Arity = %d, want 2", tree.Arity())
	}
}

func TestNewMerkleTreeEmptyItems(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if !tree.IsEmpty() {
		t.Error("expected empty tree")
	}
	if tree.LeafCount() != 0 {
		t.Errorf("LeafCount = %d, want 0", tree.LeafCount())
	}
	if tree.MaxDepth() != 0 {
		t.Errorf("MaxDepth = %d, want 0", tree.MaxDepth())
	}
}

func TestNewMerkleTreeSingleLeafArity2(t *testing.T) {
	hasher := newMockHasher()
	items := []Item[[]byte, string]{{Meta: MetaOf("abc"), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	if tree.IsEmpty() {
		t.Error("expected non-empty tree")
	}
	if tree.LeafCount() != 1 {
		t.Errorf("LeafCount = %d, want 1", tree.LeafCount())
	}
	if tree.MaxDepth() != 1 {
		t.Errorf("MaxDepth = %d, want 1", tree.MaxDepth())
	}
	// The single leaf inserts via the insert() code path, so the mock was called.
	if len(hasher.calls) < 1 {
		t.Errorf("hasher.calls = %d, want >= 1", len(hasher.calls))
	}
}

func TestNewMerkleTreeSingleLeafArity3(t *testing.T) {
	hasher := newMockHasher()
	items := []Item[[]byte, string]{{Meta: MetaOf("x"), Value: []byte{5}}}
	tree, err := NewMerkleTree(3, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	if tree.IsEmpty() {
		t.Error("expected non-empty tree")
	}
	if tree.LeafCount() != 1 {
		t.Errorf("LeafCount = %d, want 1", tree.LeafCount())
	}
	if tree.MaxDepth() != 1 {
		t.Errorf("MaxDepth = %d, want 1", tree.MaxDepth())
	}
}

func TestNewMerkleTreePerfectBinary(t *testing.T) {
	hasher := newMockHasher()
	items := []Item[[]byte, int]{
		{Meta: MetaOf(0), Value: []byte{1}},
		{Meta: MetaOf(1), Value: []byte{2}},
		{Meta: MetaOf(2), Value: []byte{3}},
		{Meta: MetaOf(3), Value: []byte{4}},
	}
	tree, err := NewMerkleTree(2, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	if tree.IsEmpty() {
		t.Error("expected non-empty tree")
	}
	if tree.LeafCount() != 4 {
		t.Errorf("LeafCount = %d, want 4", tree.LeafCount())
	}
	// depth = ceil(log_2(4)) = 2
	if tree.MaxDepth() != 2 {
		t.Errorf("MaxDepth = %d, want 2", tree.MaxDepth())
	}
	if tree.Arity() != 2 {
		t.Errorf("Arity = %d, want 2", tree.Arity())
	}
	root, err := tree.RootDigest()
	if err != nil {
		t.Fatal(err)
	}
	if len(root) != 32 {
		t.Errorf("root digest length = %d, want 32", len(root))
	}
}

func TestNewMerkleTreeArity3Perfect(t *testing.T) {
	hasher := newMockHasher()
	items := make([]Item[[]byte, int], 9)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree, err := NewMerkleTree(3, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	if tree.LeafCount() != 9 {
		t.Errorf("LeafCount = %d, want 9", tree.LeafCount())
	}
	// depth = ceil(log_3(9)) = 2
	if tree.MaxDepth() != 2 {
		t.Errorf("MaxDepth = %d, want 2", tree.MaxDepth())
	}
}

func TestNewMerkleTreeNonPerfectFill(t *testing.T) {
	hasher := newMockHasher()
	items := []Item[[]byte, string]{
		{Meta: MetaOf("a"), Value: []byte{1}},
		{Meta: MetaOf("b"), Value: []byte{2}},
		{Meta: MetaOf("c"), Value: []byte{3}},
	}
	tree, err := NewMerkleTree(2, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	if tree.LeafCount() != 3 {
		t.Errorf("LeafCount = %d, want 3", tree.LeafCount())
	}
	// depth = ceil(log_2(3)) = 2
	if tree.MaxDepth() != 2 {
		t.Errorf("MaxDepth = %d, want 2", tree.MaxDepth())
	}
	root, err := tree.RootDigest()
	if err != nil {
		t.Fatal(err)
	}
	if len(root) != 32 {
		t.Errorf("root digest length = %d, want 32", len(root))
	}
}

func TestNewMerkleTreeArity4FiveItems(t *testing.T) {
	hasher := newMockHasher()
	items := make([]Item[[]byte, int], 5)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree, err := NewMerkleTree(4, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	// depth = ceil(log_4(5)) = 2
	if tree.MaxDepth() != 2 {
		t.Errorf("MaxDepth = %d, want 2", tree.MaxDepth())
	}
	if tree.LeafCount() != 5 {
		t.Errorf("LeafCount = %d, want 5", tree.LeafCount())
	}
}

func TestNewMerkleTreeDeterministicRoots(t *testing.T) {
	items := []Item[string, int]{
		{Meta: MetaOf(0), Value: "one"},
		{Meta: MetaOf(1), Value: "two"},
	}
	treeA, err := NewMerkleTree(2, StringHasher{}, items...)
	if err != nil {
		t.Fatal(err)
	}
	treeB, err := NewMerkleTree(2, StringHasher{}, items...)
	if err != nil {
		t.Fatal(err)
	}
	rootA, _ := treeA.RootDigest()
	rootB, _ := treeB.RootDigest()
	if !bytes.Equal(rootA, rootB) {
		t.Error("deterministic root digests differ")
	}
}

// =========================================================================
// Properties
// =========================================================================

func TestMerkleTreeArityProperty(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](5, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if tree.Arity() != 5 {
		t.Errorf("Arity = %d, want 5", tree.Arity())
	}
}

func TestMerkleTreeLeafCountProperty(t *testing.T) {
	items := make([]Item[[]byte, int], 7)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if tree.LeafCount() != 7 {
		t.Errorf("LeafCount = %d, want 7", tree.LeafCount())
	}
}

// =========================================================================
// insert
// =========================================================================

func TestInsertFirstValueIntoEmptyTree(t *testing.T) {
	hasher := newMockHasher()
	tree, err := NewMerkleTree[[]byte, string](2, hasher)
	if err != nil {
		t.Fatal(err)
	}
	tree.Insert([]Item[[]byte, string]{{Meta: MetaOf("first"), Value: []byte{10}}})
	if tree.IsEmpty() {
		t.Error("expected non-empty tree")
	}
	if tree.LeafCount() != 1 {
		t.Errorf("LeafCount = %d, want 1", tree.LeafCount())
	}
	if tree.MaxDepth() != 1 {
		t.Errorf("MaxDepth = %d, want 1", tree.MaxDepth())
	}
	root, err := tree.RootDigest()
	if err != nil {
		t.Fatal(err)
	}
	if len(root) != 32 {
		t.Errorf("root digest length = %d, want 32", len(root))
	}
}

func TestInsertSequential(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, int](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{0}}})
	if tree.LeafCount() != 1 || tree.MaxDepth() != 1 {
		t.Errorf("after 1 insert: count=%d depth=%d, want 1/1", tree.LeafCount(), tree.MaxDepth())
	}
	tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(1), Value: []byte{1}}})
	if tree.LeafCount() != 2 || tree.MaxDepth() != 1 {
		t.Errorf("after 2 inserts: count=%d depth=%d, want 2/1", tree.LeafCount(), tree.MaxDepth())
	}
	tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(2), Value: []byte{2}}})
	if tree.LeafCount() != 3 || tree.MaxDepth() != 2 {
		t.Errorf("after 3 inserts: count=%d depth=%d, want 3/2", tree.LeafCount(), tree.MaxDepth())
	}
}

func TestInsertMultipleAtOnce(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	tree.Insert([]Item[[]byte, string]{
		{Meta: MetaOf("a"), Value: []byte{1}},
		{Meta: MetaOf("b"), Value: []byte{2}},
	})
	if tree.LeafCount() != 2 {
		t.Errorf("LeafCount = %d, want 2", tree.LeafCount())
	}
	if tree.MaxDepth() != 1 {
		t.Errorf("MaxDepth = %d, want 1", tree.MaxDepth())
	}
}

func TestInsertTriggersDepthIncreaseBinary(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, int](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	items := make([]Item[[]byte, int], 4)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree.Insert(items)
	if tree.MaxDepth() != 2 {
		t.Fatalf("MaxDepth = %d, want 2", tree.MaxDepth())
	}
	tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(4), Value: []byte{4}}})
	if tree.MaxDepth() != 3 {
		t.Errorf("MaxDepth = %d, want 3", tree.MaxDepth())
	}
	if tree.LeafCount() != 5 {
		t.Errorf("LeafCount = %d, want 5", tree.LeafCount())
	}
}

func TestInsertTriggersDepthIncreaseArity3(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, int](3, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	items := make([]Item[[]byte, int], 9)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree.Insert(items)
	if tree.MaxDepth() != 2 {
		t.Fatalf("MaxDepth = %d, want 2", tree.MaxDepth())
	}
	tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(9), Value: []byte{9}}})
	if tree.MaxDepth() != 3 {
		t.Errorf("MaxDepth = %d, want 3", tree.MaxDepth())
	}
	if tree.LeafCount() != 10 {
		t.Errorf("LeafCount = %d, want 10", tree.LeafCount())
	}
}

func TestInsertMaintainsValidRootDigest(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, int](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 6; i++ {
		tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(i), Value: []byte{byte(i)}}})
		root, err := tree.RootDigest()
		if err != nil {
			t.Fatal(err)
		}
		if len(root) != 32 {
			t.Errorf("after insert %d: root digest length = %d, want 32", i, len(root))
		}
	}
}

func TestInsertHashesEachLeafExactlyOnce(t *testing.T) {
	hasher := newMockHasher()
	tree, err := NewMerkleTree[[]byte, string](2, hasher)
	if err != nil {
		t.Fatal(err)
	}
	tree.Insert([]Item[[]byte, string]{{Meta: MetaOf("x"), Value: []byte{99}}})
	// The first insert also hashes the leaf digest with the byte hasher for
	// the root, but that is a different hasher and is not counted here.
	if len(hasher.calls) != 1 {
		t.Errorf("hasher.calls = %d, want 1", len(hasher.calls))
	}
}

func TestInsertRehashesInternalNodes(t *testing.T) {
	hasher := newMockHasher()
	items := []Item[[]byte, int]{
		{Meta: MetaOf(0), Value: []byte{0}},
		{Meta: MetaOf(1), Value: []byte{1}},
	}
	tree, err := NewMerkleTree(2, hasher, items...)
	if err != nil {
		t.Fatal(err)
	}
	rootBefore, err := tree.RootDigest()
	if err != nil {
		t.Fatal(err)
	}
	tree.Insert([]Item[[]byte, int]{{Meta: MetaOf(2), Value: []byte{2}}})
	rootAfter, err := tree.RootDigest()
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Equal(rootBefore, rootAfter) {
		t.Error("root digest should have changed after insert")
	}
}

// =========================================================================
// getHash
// =========================================================================

func TestGetHashEmptyPathReturnsRoot(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	root, _ := tree.RootDigest()
	got, err := tree.GetHash(nil)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, root) {
		t.Error("GetHash([]) != root digest")
	}
}

func TestGetHashLeafPath(t *testing.T) {
	items := []Item[[]byte, string]{
		{Meta: MetaOf("a"), Value: []byte{1}},
		{Meta: MetaOf("b"), Value: []byte{2}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	leafHash, err := tree.GetHash([]int{1})
	if err != nil {
		t.Fatal(err)
	}
	if len(leafHash) != 32 {
		t.Errorf("leaf hash length = %d, want 32", len(leafHash))
	}
}

func TestGetHashOutOfBoundsReturnsNil(t *testing.T) {
	items := []Item[[]byte, string]{
		{Meta: MetaOf("a"), Value: []byte{1}},
		{Meta: MetaOf("b"), Value: []byte{2}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	// Binary tree with 2 leaves: depth=1, root width=2, so path [2] is out of bounds.
	hash, err := tree.GetHash([]int{2})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if hash != nil {
		t.Errorf("hash = %v, want nil", hash)
	}
}

func TestGetHashEmptyTreeErrors(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tree.GetHash(nil); !errors.Is(err, ErrTreeEmpty) {
		t.Errorf("err = %v, want ErrTreeEmpty", err)
	}
}

func TestGetHashBeyondLeafDepthReturnsNil(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	// depth=1, path [0,0] goes deeper than the tree.
	hash, err := tree.GetHash([]int{0, 0})
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if hash != nil {
		t.Errorf("hash = %v, want nil", hash)
	}
}

// =========================================================================
// getChildrenHashes
// =========================================================================

func TestGetChildrenHashesEmptyTree(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if hashes := tree.GetChildrenHashes(nil); len(hashes) != 0 {
		t.Errorf("hashes = %v, want empty", hashes)
	}
}

func TestGetChildrenHashesRoot(t *testing.T) {
	items := []Item[[]byte, int]{
		{Meta: MetaOf(0), Value: []byte{1}},
		{Meta: MetaOf(1), Value: []byte{2}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	hashes := tree.GetChildrenHashes(nil)
	if len(hashes) != 2 {
		t.Fatalf("hashes length = %d, want 2", len(hashes))
	}
	if len(hashes[0]) != 32 || len(hashes[1]) != 32 {
		t.Error("child hashes should be 32 bytes")
	}
}

func TestGetChildrenHashesLeafNode(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	// depth=1, leaf at path [0] has no children.
	if hashes := tree.GetChildrenHashes([]int{0}); len(hashes) != 0 {
		t.Errorf("hashes = %v, want empty", hashes)
	}
}

func TestGetChildrenHashesInternalNode(t *testing.T) {
	items := make([]Item[[]byte, int], 4)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	// depth=2, children of path [0] are the first two leaves.
	hashes := tree.GetChildrenHashes([]int{0})
	if len(hashes) != 2 {
		t.Errorf("hashes length = %d, want 2", len(hashes))
	}
}

func TestGetChildrenHashesOutOfBounds(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if hashes := tree.GetChildrenHashes([]int{99}); len(hashes) != 0 {
		t.Errorf("hashes = %v, want empty", hashes)
	}
}

// =========================================================================
// getMeta
// =========================================================================

func TestGetMeta(t *testing.T) {
	items := []Item[[]byte, string]{
		{Meta: MetaOf("alpha"), Value: []byte{1}},
		{Meta: MetaOf("beta"), Value: []byte{2}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if m := tree.GetMeta(0); m == nil || *m != "alpha" {
		t.Errorf("GetMeta(0) = %v, want alpha", m)
	}
	if m := tree.GetMeta(1); m == nil || *m != "beta" {
		t.Errorf("GetMeta(1) = %v, want beta", m)
	}
}

func TestGetMetaNegativeIndex(t *testing.T) {
	items := []Item[[]byte, string]{{Meta: MetaOf("x"), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if m := tree.GetMeta(-1); m != nil {
		t.Errorf("GetMeta(-1) = %v, want nil", m)
	}
}

func TestGetMetaOutOfRange(t *testing.T) {
	items := []Item[[]byte, string]{{Meta: MetaOf("x"), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if m := tree.GetMeta(1); m != nil {
		t.Errorf("GetMeta(1) = %v, want nil", m)
	}
	if m := tree.GetMeta(100); m != nil {
		t.Errorf("GetMeta(100) = %v, want nil", m)
	}
}

func TestGetMetaEmptyTree(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if m := tree.GetMeta(0); m != nil {
		t.Errorf("GetMeta(0) = %v, want nil", m)
	}
}

func TestGetMetaAfterInserts(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	tree.Insert([]Item[[]byte, string]{{Meta: MetaOf("first"), Value: []byte{1}}})
	tree.Insert([]Item[[]byte, string]{{Meta: MetaOf("second"), Value: []byte{2}}})
	if m := tree.GetMeta(0); m == nil || *m != "first" {
		t.Errorf("GetMeta(0) = %v, want first", m)
	}
	if m := tree.GetMeta(1); m == nil || *m != "second" {
		t.Errorf("GetMeta(1) = %v, want second", m)
	}
}

func TestGetMetaUndefinedMeta(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	// A nil meta mirrors the reference's undefined meta, which reads back as null.
	tree.Insert([]Item[[]byte, string]{{Value: []byte{1}}})
	if m := tree.GetMeta(0); m != nil {
		t.Errorf("GetMeta(0) = %v, want nil", m)
	}
}

// =========================================================================
// getIndexFromPath
// =========================================================================

func TestGetIndexFromPathBinary(t *testing.T) {
	items := make([]Item[[]byte, int], 4)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		path []int
		want int
	}{
		{[]int{0, 0}, 0},
		{[]int{0, 1}, 1},
		{[]int{1, 0}, 2},
		{[]int{1, 1}, 3},
	} {
		if got := tree.GetIndexFromPath(tc.path); got != tc.want {
			t.Errorf("GetIndexFromPath(%v) = %d, want %d", tc.path, got, tc.want)
		}
	}
}

func TestGetIndexFromPathTooDeep(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if got := tree.GetIndexFromPath([]int{0, 0, 0}); got != -1 {
		t.Errorf("GetIndexFromPath([0,0,0]) = %d, want -1", got)
	}
}

func TestGetIndexFromPathArity3(t *testing.T) {
	items := make([]Item[[]byte, int], 9)
	for i := range items {
		items[i] = Item[[]byte, int]{Meta: MetaOf(i), Value: []byte{byte(i)}}
	}
	tree, err := NewMerkleTree(3, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		path []int
		want int
	}{
		{[]int{0, 0}, 0},
		{[]int{0, 1}, 1},
		{[]int{1, 0}, 3},
		{[]int{2, 2}, 8},
	} {
		if got := tree.GetIndexFromPath(tc.path); got != tc.want {
			t.Errorf("GetIndexFromPath(%v) = %d, want %d", tc.path, got, tc.want)
		}
	}
}

// =========================================================================
// getMetaByPath
// =========================================================================

func TestGetMetaByPath(t *testing.T) {
	items := []Item[[]byte, string]{
		{Meta: MetaOf("leaf0"), Value: []byte{1}},
		{Meta: MetaOf("leaf1"), Value: []byte{2}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if m := tree.GetMetaByPath([]int{0}); m == nil || *m != "leaf0" {
		t.Errorf("GetMetaByPath([0]) = %v, want leaf0", m)
	}
	if m := tree.GetMetaByPath([]int{1}); m == nil || *m != "leaf1" {
		t.Errorf("GetMetaByPath([1]) = %v, want leaf1", m)
	}
}

func TestGetMetaByPathOutOfBounds(t *testing.T) {
	items := []Item[[]byte, string]{{Meta: MetaOf("only"), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if m := tree.GetMetaByPath([]int{99}); m != nil {
		t.Errorf("GetMetaByPath([99]) = %v, want nil", m)
	}
}

// =========================================================================
// getIndexByMeta
// =========================================================================

func TestGetIndexByMeta(t *testing.T) {
	items := []Item[[]byte, int]{
		{Meta: MetaOf(10), Value: []byte{1}},
		{Meta: MetaOf(20), Value: []byte{2}},
		{Meta: MetaOf(30), Value: []byte{3}},
		{Meta: MetaOf(40), Value: []byte{4}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	cmp := func(a, b int) int { return a - b }
	for _, tc := range []struct {
		meta int
		want int
	}{
		{10, 0},
		{20, 1},
		{30, 2},
		{40, 3},
	} {
		if got := tree.GetIndexByMeta(tc.meta, cmp); got != tc.want {
			t.Errorf("GetIndexByMeta(%d) = %d, want %d", tc.meta, got, tc.want)
		}
	}
}

func TestGetIndexByMetaNotFound(t *testing.T) {
	items := []Item[[]byte, int]{
		{Meta: MetaOf(10), Value: []byte{1}},
		{Meta: MetaOf(20), Value: []byte{2}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	if got := tree.GetIndexByMeta(15, func(a, b int) int { return a - b }); got != -1 {
		t.Errorf("GetIndexByMeta(15) = %d, want -1", got)
	}
}

func TestGetIndexByMetaCustomComparator(t *testing.T) {
	items := []Item[[]byte, string]{
		{Meta: MetaOf("banana"), Value: []byte{1}},
		{Meta: MetaOf("cherry"), Value: []byte{2}},
		{Meta: MetaOf("apple"), Value: []byte{3}},
	}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	// Sorted in insert order: banana, cherry, apple.
	// apple < banana < cherry.
	if got := tree.GetIndexByMeta("cherry", strings.Compare); got != 1 {
		t.Errorf("GetIndexByMeta(cherry) = %d, want 1", got)
	}
}

// =========================================================================
// rootDigest / isEmpty
// =========================================================================

func TestRootDigestNonEmpty(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	root, err := tree.RootDigest()
	if err != nil {
		t.Fatal(err)
	}
	if len(root) != 32 {
		t.Errorf("root digest length = %d, want 32", len(root))
	}
}

func TestRootDigestEmptyTree(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, string](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tree.RootDigest(); !errors.Is(err, ErrTreeEmpty) {
		t.Errorf("err = %v, want ErrTreeEmpty", err)
	}
}

func TestIsEmpty(t *testing.T) {
	tree, err := NewMerkleTree[[]byte, int](2, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if !tree.IsEmpty() {
		t.Error("expected empty tree")
	}
	tree, err = NewMerkleTree(2, newMockHasher(), Item[[]byte, int]{Meta: MetaOf(0), Value: []byte{1}})
	if err != nil {
		t.Fatal(err)
	}
	if tree.IsEmpty() {
		t.Error("expected non-empty tree")
	}
}

// =========================================================================
// Serialization
// =========================================================================

func TestToJSONFromJSONRoundtrip(t *testing.T) {
	items := []Item[[]byte, int]{
		{Meta: MetaOf(10), Value: []byte{1}},
		{Meta: MetaOf(20), Value: []byte{2}},
	}
	original, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	data, err := original.ToJSON()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := FromJSON[[]byte, int](data, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if restored.Arity() != original.Arity() {
		t.Errorf("Arity = %d, want %d", restored.Arity(), original.Arity())
	}
	if restored.LeafCount() != original.LeafCount() {
		t.Errorf("LeafCount = %d, want %d", restored.LeafCount(), original.LeafCount())
	}
	if restored.MaxDepth() != original.MaxDepth() {
		t.Errorf("MaxDepth = %d, want %d", restored.MaxDepth(), original.MaxDepth())
	}
	restoredRoot, _ := restored.RootDigest()
	originalRoot, _ := original.RootDigest()
	if !bytes.Equal(restoredRoot, originalRoot) {
		t.Error("root digests differ after roundtrip")
	}
	if m := restored.GetMeta(0); m == nil || *m != 10 {
		t.Errorf("GetMeta(0) = %v, want 10", m)
	}
	if m := restored.GetMeta(1); m == nil || *m != 20 {
		t.Errorf("GetMeta(1) = %v, want 20", m)
	}
}

func TestToJSONFromJSONRoundtripEmpty(t *testing.T) {
	original, err := NewMerkleTree[[]byte, int](3, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	data, err := original.ToJSON()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := FromJSON[[]byte, int](data, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if !restored.IsEmpty() {
		t.Error("expected empty tree")
	}
	if restored.Arity() != 3 {
		t.Errorf("Arity = %d, want 3", restored.Arity())
	}
	if restored.LeafCount() != 0 {
		t.Errorf("LeafCount = %d, want 0", restored.LeafCount())
	}
}

func TestFromJSONRestoresHasher(t *testing.T) {
	items := []Item[string, string]{
		{Meta: MetaOf("a"), Value: "hello"},
		{Meta: MetaOf("b"), Value: "world"},
	}
	original, err := NewMerkleTree(2, StringHasher{}, items...)
	if err != nil {
		t.Fatal(err)
	}
	data, err := original.ToJSON()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := FromJSON[string, string](data, StringHasher{})
	if err != nil {
		t.Fatal(err)
	}
	restoredRoot, _ := restored.RootDigest()
	originalRoot, _ := original.RootDigest()
	if !bytes.Equal(restoredRoot, originalRoot) {
		t.Error("computed hashes differ after restore")
	}
}

func TestMarshalJSONRoundtrip(t *testing.T) {
	items := []Item[[]byte, map[string]int]{
		{Meta: MetaOf(map[string]int{"id": 1}), Value: []byte{10, 20}},
		{Meta: MetaOf(map[string]int{"id": 2}), Value: []byte{30, 40}},
	}
	original, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	data, err := original.MarshalJSON()
	if err != nil {
		t.Fatal(err)
	}
	restored, err := FromJSON[[]byte, map[string]int](data, newMockHasher())
	if err != nil {
		t.Fatal(err)
	}
	if restored.Arity() != original.Arity() ||
		restored.LeafCount() != original.LeafCount() ||
		restored.MaxDepth() != original.MaxDepth() {
		t.Error("structure differs after roundtrip")
	}
	restoredRoot, _ := restored.RootDigest()
	originalRoot, _ := original.RootDigest()
	if !bytes.Equal(restoredRoot, originalRoot) {
		t.Error("root digests differ after roundtrip")
	}
	if m := restored.GetMeta(0); m == nil || (*m)["id"] != 1 {
		t.Errorf("GetMeta(0) = %v, want {id:1}", m)
	}
	if m := restored.GetMeta(1); m == nil || (*m)["id"] != 2 {
		t.Errorf("GetMeta(1) = %v, want {id:2}", m)
	}
}

func TestMarshalJSONDigestsAreNumberArrays(t *testing.T) {
	items := []Item[[]byte, int]{{Meta: MetaOf(0), Value: []byte{1}}}
	tree, err := NewMerkleTree(2, newMockHasher(), items...)
	if err != nil {
		t.Fatal(err)
	}
	data, err := tree.ToJSON()
	if err != nil {
		t.Fatal(err)
	}
	s := string(data)
	if !strings.Contains(s, `"digest":[`) {
		t.Errorf("expected digest to be a number array, got: %s", s)
	}
}

// =========================================================================
// Hasher implementations
// =========================================================================

func TestByteHasher(t *testing.T) {
	d := ByteHasher{}.Hash([]byte{1, 2, 3})
	if len(d) != 32 {
		t.Errorf("digest length = %d, want 32", len(d))
	}
	input := []byte{0xde, 0xad}
	a := ByteHasher{}.Hash(input)
	b := ByteHasher{}.Hash(input)
	if !bytes.Equal(a, b) {
		t.Error("expected deterministic output")
	}
	c := ByteHasher{}.Hash([]byte{1})
	e := ByteHasher{}.Hash([]byte{2})
	if bytes.Equal(c, e) {
		t.Error("expected different outputs for different inputs")
	}
	// SHA3-256("") = a7ffc6f8bf1ed76651c14756a061d662...
	empty := ByteHasher{}.Hash(nil)
	if empty[0] != 0xa7 || empty[1] != 0xff {
		t.Errorf("SHA3-256(\"\") starts with %x, want a7ff", empty[:2])
	}
}

func TestStringHasher(t *testing.T) {
	d := StringHasher{}.Hash("hello")
	if len(d) != 32 {
		t.Errorf("digest length = %d, want 32", len(d))
	}
	a := StringHasher{}.Hash("deterministic")
	b := StringHasher{}.Hash("deterministic")
	if !bytes.Equal(a, b) {
		t.Error("expected deterministic output")
	}
	c := StringHasher{}.Hash("foo")
	e := StringHasher{}.Hash("bar")
	if bytes.Equal(c, e) {
		t.Error("expected different outputs for different strings")
	}
}

// =========================================================================
// End-to-end: real hasher + tree operations
// =========================================================================

func TestEndToEndRealHasher(t *testing.T) {
	items := []Item[string, string]{
		{Meta: MetaOf("tx1"), Value: "first_transaction"},
		{Meta: MetaOf("tx2"), Value: "second_transaction"},
		{Meta: MetaOf("tx3"), Value: "third_transaction"},
	}
	tree, err := NewMerkleTree(2, StringHasher{}, items...)
	if err != nil {
		t.Fatal(err)
	}

	// All insertion-era digests should be accessible.
	// Tree structure: root[A[leaf0,leaf1], B[leaf2]]
	for _, path := range [][]int{{0}, {1}, {0, 0}, {0, 1}, {1, 0}} {
		hash, err := tree.GetHash(path)
		if err != nil {
			t.Fatalf("GetHash(%v): %v", path, err)
		}
		if hash == nil {
			t.Errorf("GetHash(%v) = nil", path)
		}
	}

	// Meta retrieval (meta only stored on leaf nodes).
	if m := tree.GetMetaByPath([]int{0, 0}); m == nil || *m != "tx1" {
		t.Errorf("GetMetaByPath([0,0]) = %v, want tx1", m)
	}
	if m := tree.GetMetaByPath([]int{0, 1}); m == nil || *m != "tx2" {
		t.Errorf("GetMetaByPath([0,1]) = %v, want tx2", m)
	}
	if m := tree.GetMetaByPath([]int{1, 0}); m == nil || *m != "tx3" {
		t.Errorf("GetMetaByPath([1,0]) = %v, want tx3", m)
	}
	if m := tree.GetMeta(0); m == nil || *m != "tx1" {
		t.Errorf("GetMeta(0) = %v, want tx1", m)
	}
	if m := tree.GetMeta(1); m == nil || *m != "tx2" {
		t.Errorf("GetMeta(1) = %v, want tx2", m)
	}
	if m := tree.GetMeta(2); m == nil || *m != "tx3" {
		t.Errorf("GetMeta(2) = %v, want tx3", m)
	}

	if hashes := tree.GetChildrenHashes(nil); len(hashes) != 2 {
		t.Errorf("root children hashes length = %d, want 2", len(hashes))
	}
}

func TestEndToEndSequentialInserts(t *testing.T) {
	tree, err := NewMerkleTree[string, string](2, StringHasher{})
	if err != nil {
		t.Fatal(err)
	}
	var prev []byte
	for i := 0; i < 5; i++ {
		tree.Insert([]Item[string, string]{{
			Meta:  MetaOf(fmt.Sprintf("leaf-%d", i)),
			Value: fmt.Sprintf("value-%d", i),
		}})
		root, err := tree.RootDigest()
		if err != nil {
			t.Fatal(err)
		}
		if bytes.Equal(root, prev) {
			t.Errorf("insert %d: root digest unchanged", i)
		}
		prev = root
	}
}
