package crypto

import (
	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
)

// VerifyData mirrors ethers.verifyMessage(data, signature) === accountId.
//
// The data is hashed with the EIP-191 personal-message prefix ("\x19Ethereum
// Signed Message:\n<len><data>"), the signer is recovered from the 65-byte
// (r || s || v) signature, and the resulting EIP-55 checksummed address is
// compared against accountID.
//
// Deviation from ethers v6: go-ethereum requires a 0x-prefixed, 65-byte,
// low-s signature. Clients sign with ethers Wallet.signMessage, which always
// produces that form, so the behaviors match in practice.
func VerifyData(data []byte, signature string, accountID string) bool {
	sig, err := hexutil.Decode(signature)
	if err != nil {
		return false
	}
	// SigToPub accepts v in {0,1} and {27,28}; require the canonical length.
	if len(sig) != 65 {
		return false
	}
	// ethers produces v = recid + 27; go-ethereum v1.17 expects the raw
	// recovery id (0/1). Normalize so both conventions verify.
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	hash := accounts.TextHash(data)
	pub, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return false
	}
	return crypto.PubkeyToAddress(*pub).Hex() == accountID
}
