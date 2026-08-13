// Package digest contains the pure merkle-tree reconciliation logic of the
// sync protocol: resolving digests for paths and planning reconciliation
// actions from a peer's digest update. It has no database dependencies so it
// can be tested independently.
package digest

import (
	"log"

	"merkle-tree"
	"proto/peers"
)

var ZeroDigest = []byte{}

func IsZeroDigest(digest []byte) bool {
	return len(digest) == 0
}

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
		return ZeroDigest, ""
	}
	path := SegmentsToInts(segments[prefixLen:])
	digest, err := tree.GetHash(path)
	if err != nil || digest == nil {
		return ZeroDigest, ""
	}
	timestamp := tree.GetMetaByPath(path)
	if timestamp == nil {
		return digest, ""
	}
	return digest, *timestamp
}

// HandleDigestQuery builds the digestUpdate response payload for a digestQuery request. Paths are echoed back unchanged.
func HandleDigestQuery(tree *merkletree.MerkleTree[string, string], merkleDepth uint32, paths []*peers.TreePath) []*peers.DigestWithPath {
	result := make([]*peers.DigestWithPath, 0, len(paths))
	for _, path := range paths {

		digest, timestamp := ResolveDigest(tree, merkleDepth, path.Segments)
		result = append(result, &peers.DigestWithPath{
			Path:      path.Segments,
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
	KindSendTimestamp
	KindAskTimestamp
	KindHasEventQuery
)

// Action is one reconciliation step: descend into children, send a stored event, or ask whether the peer has an event.
type Action struct {
	Kind      ActionKind
	Children  [][]uint32 // KindQueryChildren
	Timestamp string     // KindSendTimestamp / KindHasEventQuery
}

// HandleDigestUpdate reconciles the peer's digest update against the local
// tree, producing one action per digest. Leaf mismatches with a zero peer digest request the event; other
// leaf mismatches ask whether the peer has the event; internal mismatches
// descend into the node's children.
func HandleDigestUpdate(tree *merkletree.MerkleTree[string, string], merkleDepth uint32, digests []*peers.DigestWithPath) []Action {
	maxDepth := int(merkleDepth)
	if t := tree.MaxDepth(); t > maxDepth {
		maxDepth = t
	}
	prefixLen := maxDepth - tree.MaxDepth()

	actions := make([]Action, 0, len(digests))
	for _, d := range digests {
		path := d.Path
		theirDigest := d.Digest
		ourDigest, _ := ResolveDigest(tree, merkleDepth, path)
		if !DigestsDiffer(theirDigest, ourDigest) {
			continue
		}
		isLeafNode := len(path) == maxDepth
		if isLeafNode {
			if IsZeroDigest(ourDigest) {
				actions = append(actions, Action{Kind: KindAskTimestamp, Timestamp: d.Timestamp})
			}
			timestamp := tree.GetMetaByPath(SegmentsToInts(path[prefixLen:]))
			if timestamp == nil {
				log.Printf("[WS Error] data integrity error: path=%v", path)
				continue
			}
			if IsZeroDigest(theirDigest) {
				actions = append(actions, Action{Kind: KindSendTimestamp, Timestamp: *timestamp})
			} else {
				actions = append(actions, Action{Kind: KindHasEventQuery, Timestamp: *timestamp})
			}
			continue
		}

		children := make([][]uint32, 0, tree.Arity())
		for i := range tree.Arity() {
			child := make([]uint32, 0, len(path)+1)
			child = append(child, path...)
			child = append(child, uint32(i))
			children = append(children, child)
		}
		actions = append(actions, Action{Kind: KindQueryChildren, Children: children})
	}
	return actions
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
