package crypto

import (
	"crypto/ecdsa"
	"testing"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// signData produces the 65-byte 0x-prefixed personal-message signature that
// ethers Wallet.signMessage produces (v = recid + 27, low-s).
func signData(t *testing.T, key *ecdsa.PrivateKey, data []byte) string {
	t.Helper()
	hash := accounts.TextHash(data)
	sig, err := crypto.Sign(hash, key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	sig[64] += 27 // match ethers convention (recovery id + 27)
	return hexutil.Encode(sig)
}

func newKey(t *testing.T) (*ecdsa.PrivateKey, string) {
	t.Helper()
	key, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}
	return key, crypto.PubkeyToAddress(key.PublicKey).Hex()
}

func TestVerifyData_Valid(t *testing.T) {
	key, accountID := newKey(t)
	data := []byte("hello world")
	sig := signData(t, key, data)
	if !VerifyData(data, sig, accountID) {
		t.Fatal("expected valid signature to verify")
	}
}

func TestVerifyData_WrongAccount(t *testing.T) {
	key, _ := newKey(t)
	_, otherAccountID := newKey(t)
	data := []byte("hello world")
	sig := signData(t, key, data)
	if VerifyData(data, sig, otherAccountID) {
		t.Fatal("expected signature to fail for a different account")
	}
}

func TestVerifyData_TamperedData(t *testing.T) {
	key, accountID := newKey(t)
	sig := signData(t, key, []byte("hello world"))
	if VerifyData([]byte("tampered"), sig, accountID) {
		t.Fatal("expected tampered data to fail verification")
	}
}

func TestVerifyData_BadSignature(t *testing.T) {
	key, accountID := newKey(t)
	valid := signData(t, key, []byte("hello world"))

	cases := []struct {
		name string
		sig  string
	}{
		{"empty", ""},
		{"not hex", "zzzz"},
		{"no 0x prefix", valid[2:]},
		{"short", valid[:len(valid)-2]},
		{"long", valid + "00"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if VerifyData([]byte("hello world"), tc.sig, accountID) {
				t.Fatalf("expected invalid signature %q to fail", tc.sig)
			}
		})
	}
}
