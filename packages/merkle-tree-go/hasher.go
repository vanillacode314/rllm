package merkletree

import "golang.org/x/crypto/sha3"

// Hasher computes the digest for a leaf value.
//
// Implementations must be deterministic: the same value must always produce
// the same digest.
type Hasher[T any] interface {
	Hash(value T) []byte
}

// ByteHasher hashes raw byte slices with SHA3-256.
type ByteHasher struct{}

// Hash returns the SHA3-256 digest of value.
func (ByteHasher) Hash(value []byte) []byte {
	h := sha3.New256()
	_, _ = h.Write(value)
	return h.Sum(nil)
}

// StringHasher hashes UTF-8 encoded strings with SHA3-256.
type StringHasher struct{}

// Hash returns the SHA3-256 digest of the UTF-8 encoding of value.
func (StringHasher) Hash(value string) []byte {
	h := sha3.New256()
	_, _ = h.Write([]byte(value))
	return h.Sum(nil)
}

// hashDigests returns the SHA3-256 digest of the concatenation of digests.
// It mirrors how the reference implementation hashes internal nodes.
func hashDigests(digests [][]byte) []byte {
	h := sha3.New256()
	for _, digest := range digests {
		_, _ = h.Write(digest)
	}
	return h.Sum(nil)
}
