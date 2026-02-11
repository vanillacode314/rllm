import { ethers } from 'ethers';

export function verifyData(data: string | Uint8Array, signature: string, accountId: string) {
	const recoveredAccountId = ethers.verifyMessage(data, signature);
	return recoveredAccountId === accountId;
}
