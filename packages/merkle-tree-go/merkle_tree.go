package merkletree

import (
	"encoding/json"
	"errors"
	"math"
)

// logPrecisionForDepthCalculations is the decimal precision used when
// deriving tree depth from the leaf count (mirrors the reference).
const logPrecisionForDepthCalculations = 3

// ErrArity is returned when arity is less than 2.
var ErrArity = errors.New("Arity must be greater than 1")

// ErrTreeEmpty is returned when an operation requires a non-empty tree.
var ErrTreeEmpty = errors.New("Tree is empty")

// Item is a leaf to insert into the tree: optional metadata plus the value
// to be hashed.
type Item[T any, TMeta any] struct {
	// Meta is optional metadata associated with the leaf (nil to omit).
	Meta *TMeta
	// Value is the leaf value, hashed with the tree's hasher.
	Value T
}

// MetaOf returns a pointer to v, useful for building Item values.
func MetaOf[TMeta any](v TMeta) *TMeta {
	return &v
}

// nodeValue is the value stored in each node of the underlying tree.
type nodeValue[TMeta any] struct {
	digest []byte
	meta   *TMeta
}

// MerkleTree is an arity-N merkle tree. Leaves are hashed with a pluggable
// hasher; internal node digests are SHA3-256 over the concatenation of their
// children digests.
type MerkleTree[T any, TMeta any] struct {
	arity         int
	hasher        Hasher[T]
	leafCount     int
	leafMetaCache []*TMeta
	maxDepth      int
	tree          *Tree[nodeValue[TMeta]]
}

// NewMerkleTree creates a tree with the given arity and hasher, optionally
// building it from items. It returns an error when arity is less than 2.
func NewMerkleTree[T any, TMeta any](arity int, hasher Hasher[T], items ...Item[T, TMeta]) (*MerkleTree[T, TMeta], error) {
	if arity < 2 {
		return nil, ErrArity
	}
	t := &MerkleTree[T, TMeta]{
		arity:     arity,
		hasher:    hasher,
		leafCount: len(items),
		tree:      NewTree[nodeValue[TMeta]](),
	}
	if len(items) == 0 {
		return t, nil
	}
	t.leafMetaCache = make([]*TMeta, len(items))
	for i, item := range items {
		t.leafMetaCache[i] = item.Meta
	}
	// A single leaf goes through the insert path so the tree always has a
	// hashed internal node as its root (mirrors the reference).
	if len(items) == 1 {
		t.leafCount = 0
		t.Insert(items)
		return t, nil
	}

	t.maxDepth = int(math.Ceil(round(
		math.Log(float64(len(items)))/math.Log(float64(arity)),
		logPrecisionForDepthCalculations,
	)))

	children := make([]*Node[nodeValue[TMeta]], 0, len(items))
	for _, item := range items {
		children = append(children, NewNode(nodeValue[TMeta]{
			digest: hasher.Hash(item.Value),
			meta:   item.Meta,
		}))
	}
	for depth := 0; depth < t.maxDepth; depth++ {
		newChildren := make([]*Node[nodeValue[TMeta]], 0, (len(children)+t.arity-1)/t.arity)
		for i := 0; i < len(children); i += t.arity {
			end := min(i+t.arity, len(children))
			digests := make([][]byte, 0, end-i)
			for j := i; j < end; j++ {
				digests = append(digests, children[j].Value.digest)
			}
			node := NewNode(nodeValue[TMeta]{digest: hashDigests(digests)})
			for j := i; j < end; j++ {
				node.InsertNode(children[j])
			}
			newChildren = append(newChildren, node)
		}
		children = newChildren
	}
	t.tree.SetRootNode(children[0])
	return t, nil
}

// Arity returns the configured branching factor.
func (t *MerkleTree[T, TMeta]) Arity() int {
	return t.arity
}

// LeafCount returns the number of leaves.
func (t *MerkleTree[T, TMeta]) LeafCount() int {
	return t.leafCount
}

// MaxDepth returns the depth of the tree (the root sits at depth 0).
func (t *MerkleTree[T, TMeta]) MaxDepth() int {
	return t.maxDepth
}

// IsEmpty reports whether the tree has no leaves.
func (t *MerkleTree[T, TMeta]) IsEmpty() bool {
	return t.tree.Root == nil
}

// RootDigest returns the digest of the root node.
func (t *MerkleTree[T, TMeta]) RootDigest() ([]byte, error) {
	if t.tree.Root == nil {
		return nil, ErrTreeEmpty
	}
	return t.tree.Root.Value.digest, nil
}

// GetChildrenHashes returns the digests of the children of the node at path,
// or nil when the tree is empty or the path is out of bounds.
func (t *MerkleTree[T, TMeta]) GetChildrenHashes(path []int) [][]byte {
	node := t.tree.Root
	if node == nil {
		return nil
	}
	for _, index := range path {
		if index >= node.Width() {
			return nil
		}
		child, err := node.GetNthChild(index)
		if err != nil {
			return nil
		}
		node = child
	}
	hashes := make([][]byte, 0, node.Width())
	for _, child := range node.Children {
		hashes = append(hashes, child.Value.digest)
	}
	return hashes
}

// GetRootHash returns the digest of the root node.
func (t *MerkleTree[T, TMeta]) GetRootHash() []byte {
	node := t.tree.Root
	if node == nil {
		return []byte{}
	}
	return node.Value.digest
}

// GetHash returns the digest of the node at path. It returns an error when
// the tree is empty, and a nil digest with a nil error when the path is out
// of bounds.
func (t *MerkleTree[T, TMeta]) GetHash(path []int) ([]byte, error) {
	node := t.tree.Root
	if node == nil {
		return nil, ErrTreeEmpty
	}
	for _, index := range path {
		if index >= node.Width() {
			return nil, nil
		}
		child, err := node.GetNthChild(index)
		if err != nil {
			return nil, nil
		}
		node = child
	}
	return node.Value.digest, nil
}

// GetMeta returns the metadata of the leaf at index, or nil when the index is
// out of bounds or the leaf carries no metadata.
func (t *MerkleTree[T, TMeta]) GetMeta(index int) *TMeta {
	if index < 0 || index >= t.leafCount {
		return nil
	}
	return t.leafMetaCache[index]
}

// GetMetaByPath returns the metadata of the leaf addressed by path, or nil
// when the path does not address a leaf or the leaf carries no metadata.
func (t *MerkleTree[T, TMeta]) GetMetaByPath(path []int) *TMeta {
	return t.GetMeta(t.GetIndexFromPath(path))
}

// GetIndexByMeta returns the index of the leaf whose metadata compares equal
// to meta, using binary search with compare over the metadata cache. It
// returns -1 when no such leaf exists.
func (t *MerkleTree[T, TMeta]) GetIndexByMeta(meta TMeta, compare func(a, b TMeta) int) int {
	left, right := 0, t.leafCount-1
	for left <= right {
		mid := (left + right) >> 1
		var currentMeta TMeta
		if m := t.GetMeta(mid); m != nil {
			currentMeta = *m
		}
		cmp := compare(currentMeta, meta)
		if cmp == 0 {
			return mid
		} else if cmp < 0 {
			left = mid + 1
		} else {
			right = mid - 1
		}
	}
	return -1
}

// GetIndexFromPath returns the index of the leaf addressed by path, padding
// the path with zeroes up to maxDepth. It returns -1 when the path is deeper
// than the tree.
func (t *MerkleTree[T, TMeta]) GetIndexFromPath(path []int) int {
	if len(path) > t.maxDepth {
		return -1
	}
	index := 0
	for d := 0; d < t.maxDepth; d++ {
		childIndex := 0
		if d < len(path) {
			childIndex = path[d]
		}
		index = index*t.arity + childIndex
	}
	return index
}

// Insert adds items to the tree, rehashing affected nodes bottom-up.
func (t *MerkleTree[T, TMeta]) Insert(items []Item[T, TMeta]) {
	if len(items) == 0 {
		return
	}
	t.leafCount += len(items)

	depthExpansion := int(math.Ceil(round(
		math.Log(float64(len(items)+1))/math.Log(float64(t.arity)),
		logPrecisionForDepthCalculations,
	))) + 2
	estimatedMaxDepth := t.maxDepth + depthExpansion
	dirtyNodesByHeight := make([]map[*Node[nodeValue[TMeta]]]struct{}, estimatedMaxDepth)
	for i := range dirtyNodesByHeight {
		dirtyNodesByHeight[i] = make(map[*Node[nodeValue[TMeta]]]struct{})
	}

	var path []*Node[nodeValue[TMeta]]

	for _, item := range items {
		t.leafMetaCache = append(t.leafMetaCache, item.Meta)
		digest := t.hasher.Hash(item.Value)

		// Phase 1: empty tree.
		if t.tree.Root == nil {
			t.maxDepth = 1
			rootDigest := ByteHasher{}.Hash(digest)
			t.tree.Root = NewNode(nodeValue[TMeta]{digest: rootDigest})
			t.tree.Root.Insert(nodeValue[TMeta]{digest: digest, meta: item.Meta})
			dirtyNodesByHeight[0][t.tree.Root] = struct{}{}
			continue
		}

		// Phase 2: walk down the rightmost path.
		path = path[:0]
		node := t.tree.Root
		for depth := 0; depth < t.maxDepth; depth++ {
			path = append(path, node)
			if depth < t.maxDepth-1 {
				child, err := node.GetNthChild(node.Width() - 1)
				if err != nil {
					// Unreachable: every node on the rightmost path of a
					// consistent tree has at least one child.
					panic(err)
				}
				node = child
			}
		}

		// Phase 3: insert the value into the tree.
		leafParent := path[len(path)-1]
		if leafParent.Width() < t.arity {
			leafParent.Insert(nodeValue[TMeta]{digest: digest, meta: item.Meta})
		} else {
			splitIndex := -1
			for i := len(path) - 2; i >= 0; i-- {
				if path[i].Width() < t.arity {
					splitIndex = i
					break
				}
			}

			treeFull := splitIndex < 0
			if treeFull {
				t.maxDepth++
				newRoot := NewNode(nodeValue[TMeta]{digest: t.tree.Root.Value.digest})
				newRoot.InsertNode(t.tree.Root)
				t.tree.Root = newRoot
				splitIndex = 0
				path = append([]*Node[nodeValue[TMeta]]{newRoot}, path...)
			}

			for depth := splitIndex + 1; depth < t.maxDepth; depth++ {
				newNode := NewNode(nodeValue[TMeta]{})
				path[depth-1].InsertNode(newNode)
				if depth < len(path) {
					path[depth] = newNode
				} else {
					path = append(path, newNode)
				}
			}
			path[len(path)-1].Insert(nodeValue[TMeta]{digest: digest, meta: item.Meta})
		}

		for i := 0; i < len(path); i++ {
			dirtyNodesByHeight[len(path)-1-i][path[i]] = struct{}{}
		}
	}

	// Phase 4: rehash bottom-up along the affected paths.
	for height := 0; height < t.maxDepth; height++ {
		for node := range dirtyNodesByHeight[height] {
			digests := make([][]byte, 0, node.Width())
			for _, child := range node.Children {
				digests = append(digests, child.Value.digest)
			}
			node.Value.digest = hashDigests(digests)
		}
	}
}

// jsonTree mirrors the serialized form of a MerkleTree.
type jsonTree struct {
	Arity     int       `json:"arity"`
	LeafCount int       `json:"leafCount"`
	MaxDepth  int       `json:"maxDepth"`
	Tree      *jsonNode `json:"tree"`
}

// jsonNode mirrors the serialized form of a tree node.
type jsonNode struct {
	Children []*jsonNode   `json:"children"`
	Value    jsonNodeValue `json:"value"`
}

// jsonNodeValue mirrors the serialized value of a tree node. Digests are
// encoded as arrays of bytes, matching the reference implementation.
type jsonNodeValue struct {
	Digest digestJSON       `json:"digest"`
	Meta   *json.RawMessage `json:"meta,omitempty"`
}

// digestJSON encodes a digest as an array of numbers (like the reference
// implementation's toString format).
type digestJSON []byte

func (d digestJSON) MarshalJSON() ([]byte, error) {
	arr := make([]int, len(d))
	for i, b := range d {
		arr[i] = int(b)
	}
	return json.Marshal(arr)
}

func (d *digestJSON) UnmarshalJSON(data []byte) error {
	var arr []int
	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}
	out := make([]byte, len(arr))
	for i, v := range arr {
		out[i] = byte(v)
	}
	*d = out
	return nil
}

// MarshalJSON serializes the tree. Digests are encoded as arrays of numbers,
// matching the reference implementation's toString format.
func (t *MerkleTree[T, TMeta]) MarshalJSON() ([]byte, error) {
	jt := jsonTree{
		Arity:     t.arity,
		LeafCount: t.leafCount,
		MaxDepth:  t.maxDepth,
	}
	if t.tree.Root != nil {
		root, err := treeNodeToJSON(t.tree.Root)
		if err != nil {
			return nil, err
		}
		jt.Tree = root
	}
	return json.Marshal(jt)
}

// ToJSON returns the JSON-encoded serialization of the tree.
func (t *MerkleTree[T, TMeta]) ToJSON() ([]byte, error) {
	return t.MarshalJSON()
}

// FromJSON reconstructs a tree from data (as produced by ToJSON/MarshalJSON)
// using hasher for subsequent insert operations.
func FromJSON[T any, TMeta any](data []byte, hasher Hasher[T]) (*MerkleTree[T, TMeta], error) {
	var jt jsonTree
	if err := json.Unmarshal(data, &jt); err != nil {
		return nil, err
	}
	tree, err := NewMerkleTree[T, TMeta](jt.Arity, hasher)
	if err != nil {
		return nil, err
	}
	if jt.Tree != nil {
		root, err := jsonNodeToTree[TMeta](jt.Tree)
		if err != nil {
			return nil, err
		}
		tree.tree.SetRootNode(root)
	}
	tree.leafCount = jt.LeafCount
	tree.maxDepth = jt.MaxDepth
	tree.rebuildMetaCache()
	return tree, nil
}

func treeNodeToJSON[TMeta any](n *Node[nodeValue[TMeta]]) (*jsonNode, error) {
	jn := &jsonNode{Children: make([]*jsonNode, 0, len(n.Children))}
	for _, child := range n.Children {
		cj, err := treeNodeToJSON(child)
		if err != nil {
			return nil, err
		}
		jn.Children = append(jn.Children, cj)
	}
	vj, err := nodeValueToJSON(n.Value)
	if err != nil {
		return nil, err
	}
	jn.Value = vj
	return jn, nil
}

func nodeValueToJSON[TMeta any](v nodeValue[TMeta]) (jsonNodeValue, error) {
	jv := jsonNodeValue{Digest: digestJSON(v.digest)}
	if v.meta != nil {
		raw, err := json.Marshal(v.meta)
		if err != nil {
			return jv, err
		}
		rm := json.RawMessage(raw)
		jv.Meta = &rm
	}
	return jv, nil
}

func jsonNodeToTree[TMeta any](jn *jsonNode) (*Node[nodeValue[TMeta]], error) {
	v, err := jsonValueToNodeValue[TMeta](jn.Value)
	if err != nil {
		return nil, err
	}
	node := NewNode(v)
	for _, cj := range jn.Children {
		child, err := jsonNodeToTree[TMeta](cj)
		if err != nil {
			return nil, err
		}
		node.InsertNode(child)
	}
	return node, nil
}

func jsonValueToNodeValue[TMeta any](jv jsonNodeValue) (nodeValue[TMeta], error) {
	v := nodeValue[TMeta]{digest: []byte(jv.Digest)}
	if jv.Meta != nil {
		var meta TMeta
		if err := json.Unmarshal(*jv.Meta, &meta); err != nil {
			return v, err
		}
		v.meta = &meta
	}
	return v, nil
}

// rebuildMetaCache rebuilds the leaf metadata cache by walking the tree down
// to leaf depth.
func (t *MerkleTree[T, TMeta]) rebuildMetaCache() {
	root := t.tree.Root
	if root == nil {
		t.leafMetaCache = nil
		return
	}
	var leaves []*TMeta
	var collect func(node *Node[nodeValue[TMeta]], depth int)
	collect = func(node *Node[nodeValue[TMeta]], depth int) {
		if depth == t.maxDepth {
			leaves = append(leaves, node.Value.meta)
			return
		}
		for i := 0; i < node.Width(); i++ {
			collect(node.Children[i], depth+1)
		}
	}
	collect(root, 0)
	t.leafMetaCache = leaves
}
