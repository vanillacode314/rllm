package digest

import (
	"testing"

	"merkle-tree"
	"proto/peers"
)

// buildTree creates a tree with arity 16 and the given leaf timestamps
// (mirrors how the server builds trees for account data).
func buildTree(t *testing.T, timestamps ...string) *merkletree.MerkleTree[string, string] {
	t.Helper()
	tree, err := merkletree.NewMerkleTree[string, string](16, merkletree.StringHasher{})
	if err != nil {
		t.Fatalf("NewMerkleTree: %v", err)
	}
	items := make([]merkletree.Item[string, string], 0, len(timestamps))
	for _, ts := range timestamps {
		items = append(items, merkletree.Item[string, string]{Meta: merkletree.MetaOf(ts), Value: ts})
	}
	tree.Insert(items)
	return tree
}

func TestIsZeroDigest(t *testing.T) {
	if !IsZeroDigest(nil) || !IsZeroDigest([]byte{}) {
		t.Fatal("expected empty digests to be zero")
	}
	if IsZeroDigest([]byte{0}) {
		t.Fatal("expected single zero byte not to be zero digest")
	}
}

func TestUnique(t *testing.T) {
	got := Unique([]string{"b", "a", "b", "c", "a"})
	want := []string{"b", "a", "c"}
	if len(got) != len(want) {
		t.Fatalf("Unique = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("Unique = %v, want %v", got, want)
		}
	}
}

func TestResolveDigest(t *testing.T) {
	tree := buildTree(t, "1", "2", "3", "4")

	t.Run("real path returns hash", func(t *testing.T) {
		d, _ := ResolveDigest(tree, 0, []uint32{})
		if IsZeroDigest(d) {
			t.Fatal("expected root digest for non-empty tree")
		}
	})
	t.Run("empty tree returns zero", func(t *testing.T) {
		empty, err := merkletree.NewMerkleTree[string, string](16, merkletree.StringHasher{})
		if err != nil {
			t.Fatal(err)
		}
		digest, _ := ResolveDigest(empty, 0, []uint32{})
		if !IsZeroDigest(digest) {
			t.Fatal("expected zero digest for empty tree")
		}
	})
	t.Run("virtual prefix path returns zero", func(t *testing.T) {
		// Peer tree deeper than ours: extra leading segments must be zero to
		// be "real"; a non-zero leading segment is virtual → zero digest.
		empty, err := merkletree.NewMerkleTree[string, string](16, merkletree.StringHasher{})
		if err != nil {
			t.Fatal(err)
		}
		d, _ := ResolveDigest(empty, 0, []uint32{})
		if !IsZeroDigest(d) {
			t.Fatal("expected zero digest for empty tree")
		}
		// [0, 1] maps to our real path [1] (root child 1).
		d, _ = ResolveDigest(tree, 2, []uint32{0, 1})
		if IsZeroDigest(d) {
			t.Fatal("expected real digest for zero-padded path")
		}
		// [0, 1, 0] maps to [1, 0], deeper than our depth-1 tree → zero.
		d, _ = ResolveDigest(tree, 2, []uint32{0, 1, 0})
		if !IsZeroDigest(d) {
			t.Fatal("expected zero digest for too-deep path")
		}
	})
	t.Run("out of bounds returns zero", func(t *testing.T) {
		d, _ := ResolveDigest(tree, 0, []uint32{99})
		if !IsZeroDigest(d) {
			t.Fatal("expected zero digest for out-of-bounds path")
		}
	})
}

func TestHandleDigestQuery(t *testing.T) {
	tree := buildTree(t, "1", "2", "3", "4")

	t.Run("root at own depth returns digest", func(t *testing.T) {
		result := HandleDigestQuery(tree, 0, []*peers.DigestQuery{{Path: []uint32{}}})
		if len(result) != 1 || len(result[0].Path) != 0 {
			t.Fatalf("unexpected result: %+v", result)
		}
		if IsZeroDigest(result[0].Digest) {
			t.Fatal("expected root digest")
		}
	})

	t.Run("paths echoed with virtual handling", func(t *testing.T) {
		paths := []*peers.DigestQuery{
			{Path: []uint32{0, 1}},    // real (maps to [1])
			{Path: []uint32{1, 0, 0}}, // virtual
		}
		result := HandleDigestQuery(tree, 2, paths)
		if len(result) != 2 {
			t.Fatalf("result length = %d, want 2", len(result))
		}
		if len(result[0].Path) != 2 || len(result[1].Path) != 3 {
			t.Fatal("paths not echoed")
		}
		if IsZeroDigest(result[0].Digest) {
			t.Fatal("expected real digest")
		}
		if !IsZeroDigest(result[1].Digest) {
			t.Fatal("expected zero digest for virtual path")
		}
	})
}

func TestHandleDigestUpdate(t *testing.T) {
	tree := buildTree(t, "1", "2", "3", "4")

	t.Run("matching root yields no actions", func(t *testing.T) {
		root, _ := ResolveDigest(tree, 0, []uint32{})
		actions := HandleDigestUpdate(tree, 0, []*peers.DigestUpdate{{Path: nil, Digest: root}})
		if len(actions) != 0 {
			t.Fatalf("expected no actions, got %+v", actions)
		}
	})

	t.Run("root mismatch descends into children", func(t *testing.T) {
		actions := HandleDigestUpdate(tree, 0, []*peers.DigestUpdate{{Path: nil, Digest: []byte("wrong")}})
		if len(actions) != 1 {
			t.Fatalf("expected 1 action, got %d", len(actions))
		}
		if actions[0].Kind != KindQueryChildren {
			t.Fatalf("expected KindQueryChildren, got %d", actions[0].Kind)
		}
		if len(actions[0].Children) != 16 {
			t.Fatalf("expected 16 children, got %d", len(actions[0].Children))
		}
		if len(actions[0].Children[15]) != 1 || actions[0].Children[15][0] != 15 {
			t.Fatalf("unexpected children paths: %v", actions[0].Children[15])
		}
	})

	t.Run("leaf with zero peer digest requests event", func(t *testing.T) {
		single := buildTree(t, "ts1")
		leafDigest, timestamp := ResolveDigest(single, 1, []uint32{0})
		if IsZeroDigest(leafDigest) {
			t.Fatal("expected non-zero leaf digest")
		}
		if timestamp != "ts1" {
			t.Fatalf("expected timestamp ts1, got %q", timestamp)
		}
		actions := HandleDigestUpdate(single, 1, []*peers.DigestUpdate{{Path: []uint32{0}, Digest: ZeroDigest}})
		if len(actions) != 1 || actions[0].Kind != KindSendTimestamp || actions[0].Timestamp != "ts1" {
			t.Fatalf("expected KindSendTimestamp(ts1), got %+v", actions)
		}
	})

	t.Run("virtual leaf with zero our digest is skipped", func(t *testing.T) {
		// Peer tree deeper than ours: [1, x] is virtual (non-zero prefix), so
		// our digest is zero and the leaf is skipped.
		single := buildTree(t, "ts1")
		actions := HandleDigestUpdate(single, 2, []*peers.DigestUpdate{{Path: []uint32{1, 0}, Digest: []byte("other")}})
		if len(actions) != 0 {
			t.Fatalf("expected no actions for virtual leaf, got %+v", actions)
		}
	})
}

func TestSegmentsToInts(t *testing.T) {
	got := SegmentsToInts([]uint32{0, 1, 2})
	want := []int{0, 1, 2}
	if len(got) != len(want) {
		t.Fatalf("SegmentsToInts = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("SegmentsToInts = %v, want %v", got, want)
		}
	}
	if SegmentsToInts(nil) != nil {
		t.Fatal("expected nil for empty segments")
	}
}
