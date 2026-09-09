// Package digest contains the pure merkle-tree reconciliation logic of the
// sync protocol: resolving digests for paths and planning reconciliation
// actions from a peer's digest update. It has no database dependencies so it
// can be tested independently.
package digest

import (
	"merkle-tree"
	"proto/peers"
)

func Unique[T comparable](items []T) []T {
	seen := make(map[T]struct{}, len(items))
	out := make([]T, 0, len(items))
	for _, item := range items {
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out
}

func DigestsDiffer(a, b []byte) bool {
	if len(a) != len(b) {
		return true
	}
	for i := range a {
		if a[i] != b[i] {
			return true
		}
	}
	return false
}

// isVirtualPath reports whether a path addresses a "virtual" node: one
// outside the local tree's depth, where every extra leading segment must be
// zero (the reference pads the shorter tree with zero-prefix nodes).
func isVirtualPath(segments []uint32, prefixLen int) bool {
	if len(segments) < prefixLen {
		return true
	}
	for i := range prefixLen {
		if segments[i] != 0 {
			return true
		}
	}
	return false
}

// ResolveDigest returns the local digest for a path, or the zero digest when
// the tree is empty, the path is virtual, or the path is out of bounds.
func ResolveDigest(tree *merkletree.MerkleTree[string, string], merkleDepth uint32, segments []uint32) ([]byte, string) {
	maxDepth := int(merkleDepth)
	if t := tree.MaxDepth(); t > maxDepth {
		maxDepth = t
	}
	prefixLen := maxDepth - tree.MaxDepth()
	if tree.IsEmpty() || isVirtualPath(segments, prefixLen) {
		return []byte{}, ""
	}
	path := SegmentsToInts(segments[prefixLen:])
	digest, err := tree.GetHash(path)
	if err != nil || digest == nil {
		return []byte{}, ""
	}
	timestamp := tree.GetMetaByPath(path)
	if timestamp == nil {
		return digest, ""
	}
	return digest, *timestamp
}

// HandleDigestQuery builds the digestUpdates response payload for a digestQueries request. Queries are echoed back unchanged.
func HandleDigestQuery(tree *merkletree.MerkleTree[string, string], merkleDepth uint32, queries []*peers.DigestQuery) []*peers.DigestUpdate {
	result := make([]*peers.DigestUpdate, 0, len(queries))
	for _, query := range queries {

		digest, timestamp := ResolveDigest(tree, merkleDepth, query.Path)
		result = append(result, &peers.DigestUpdate{
			Path:      query.Path,
			Digest:    digest,
			Timestamp: timestamp,
		})
	}
	return result
}

// ActionKind enumerates the reconciliation actions produced by HandleDigestUpdate.
type ActionKind int

const (
	KindQueryChildren ActionKind = iota
	KindAskTimestamp
)

// Action is one reconciliation step: descend into children, send a stored event, or ask whether the peer has an event.
type Action struct {
	Kind      ActionKind
	Children  [][]uint32 // KindQueryChildren
	Timestamp string     // KindSendTimestamp
}

// HandleDigestUpdate reconciles the peer's digest update against the local
// tree, producing one action per digest. Leaf mismatches with a zero peer digest request the event; other
// leaf mismatches ask whether the peer has the event; internal mismatches
// descend into the node's children.
func HandleDigestUpdate(tree *merkletree.MerkleTree[string, string], merkleDepth uint32, updates []*peers.DigestUpdate) *Action {
	maxDepth := int(merkleDepth)
	if t := tree.MaxDepth(); t > maxDepth {
		maxDepth = t
	}
	lastTimestamp, mismatchPath := findMismatch(tree, merkleDepth, updates)
	if mismatchPath == nil {
		return nil
	}
	isLeafNode := len(*mismatchPath) == maxDepth
	if isLeafNode {
		return &Action{Kind: KindAskTimestamp, Timestamp: lastTimestamp}
	}
	return &Action{Kind: KindQueryChildren, Children: makeChildPaths(*mismatchPath, tree.Arity())}
}

func makeChildPaths(basePath []uint32, arity int) [][]uint32 {
	children := make([][]uint32, 0, arity)
	for i := range arity {
		child := make([]uint32, 0, len(basePath)+1)
		child = append(child, basePath...)
		child = append(child, uint32(i))
		children = append(children, child)
	}
	return children
}

func findMismatch(tree *merkletree.MerkleTree[string, string], merkleDepth uint32, updates []*peers.DigestUpdate) (string, *[]uint32) {
	lastTimestamp := ""
	for _, update := range updates {
		path := update.Path
		theirDigest := update.Digest
		ourDigest, _ := ResolveDigest(tree, merkleDepth, path)
		if DigestsDiffer(theirDigest, ourDigest) {
			return lastTimestamp, &update.Path
		}
		lastTimestamp = update.Timestamp
	}
	return lastTimestamp, nil
}

// SegmentsToInts converts a proto path (uint32) to the int path used by the
// merkle tree package.
func SegmentsToInts(segments []uint32) []int {
	if len(segments) == 0 {
		return nil
	}
	out := make([]int, len(segments))
	for i, s := range segments {
		out[i] = int(s)
	}
	return out
}
