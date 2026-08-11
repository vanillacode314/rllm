# merkle-tree-go

A Go rewrite of the [`@packages/merkle-tree`](../merkle-tree) merkle tree,
implemented as a standalone Go module.

An arity-N merkle tree with a pluggable hasher. Leaves are hashed with the
configured hasher; internal node digests are SHA3-256 over the concatenation
of their children digests. The tree structure, insert/split/rehash algorithm,
depth calculations, and JSON serialization format are byte-for-byte compatible
with the TypeScript reference (verified by cross-language tests: identical
inputs produce identical root digests and identical serialized JSON).

## Usage

```go
import "merkle-tree-go"

// Build a binary tree from items. Meta is optional (nil to omit).
items := []merkletree.Item[string, string]{
    {Meta: merkletree.MetaOf("tx1"), Value: "first_transaction"},
    {Meta: merkletree.MetaOf("tx2"), Value: "second_transaction"},
    {Meta: merkletree.MetaOf("tx3"), Value: "third_transaction"},
}

tree, err := merkletree.NewMerkleTree(2, merkletree.StringHasher{}, items...)
if err != nil {
    // arity < 2
}

root, err := tree.RootDigest() // 32-byte SHA3-256 digest

// Insert more leaves later (can also batch).
tree.Insert([]merkletree.Item[string, string]{{Meta: merkletree.MetaOf("tx4"), Value: "fourth_transaction"}})

// Inspect nodes by path ([]int of child indices from the root).
hash, err := tree.GetHash([]int{0, 0}) // leaf digest; nil digest + nil error if out of bounds
hashes := tree.GetChildrenHashes([]int{0})

// Leaf metadata lookups.
meta := tree.GetMeta(0)        // *string, nil when out of bounds or absent
meta = tree.GetMetaByPath([]int{0, 0})
index := tree.GetIndexFromPath([]int{0, 1})
index = tree.GetIndexByMeta("tx2", strings.Compare) // -1 when not found

// Serialization (digests encoded as arrays of numbers, like the reference).
data, err := tree.ToJSON()
restored, err := merkletree.FromJSON[string, string](data, merkletree.StringHasher{})
```

## Hashers

- `ByteHasher` — SHA3-256 over `[]byte`.
- `StringHasher` — SHA3-256 over the UTF-8 encoding of a `string`.

Implement `Hasher[T]` (`Hash(value T) []byte`) for custom leaf types.

## API mapping

The Go API mirrors the reference with Go conventions (errors instead of
throws, `*TMeta` / nil instead of `null`):

| Reference (TS)                  | Go                                   |
| ------------------------------- | ------------------------------------ |
| `new MerkleTree(arity, hasher)` | `NewMerkleTree[T, TMeta](arity, hasher)` |
| `tree.arity`                    | `tree.Arity()`                       |
| `tree.leafCount`                | `tree.LeafCount()`                   |
| `tree.maxDepth`                 | `tree.MaxDepth()`                    |
| `tree.isEmpty()`                | `tree.IsEmpty()`                     |
| `tree.rootDigest()`             | `tree.RootDigest() ([]byte, error)`  |
| `tree.insert(values)`           | `tree.Insert(items []Item[T, TMeta])`|
| `tree.getHash(path)`            | `tree.GetHash(path) ([]byte, error)` |
| `tree.getChildrenHashes(path)`  | `tree.GetChildrenHashes(path) [][]byte` |
| `tree.getMeta(index)`           | `tree.GetMeta(index) *TMeta`         |
| `tree.getMetaByPath(path)`      | `tree.GetMetaByPath(path) *TMeta`    |
| `tree.getIndexFromPath(path)`   | `tree.GetIndexFromPath(path) int`    |
| `tree.getIndexByMeta(meta, cmp)`| `tree.GetIndexByMeta(meta, cmp) int` |
| `tree.toJSON()` / `toString()`  | `tree.ToJSON() ([]byte, error)` / `MarshalJSON` |
| `MerkleTree.fromJSON/fromString`| `FromJSON[T, TMeta](data, hasher)`   |

Notes:

- `GetHash` returns `ErrTreeEmpty` on an empty tree and a `nil` digest with a
  `nil` error when the path is out of bounds (mirroring the reference's
  `null`).
- Metadata is optional per leaf (`*TMeta`); a `nil` meta reads back as `nil`,
  like `undefined` in the reference.
- `Node[T]` and `Tree[T]` (the underlying generic tree utilities) are exported
  too.

## Development

```bash
go test ./...
go vet ./...
go build ./...
```
