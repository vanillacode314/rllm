import { decryptDataWithKey, encryptDataWithKey } from '~/utils/crypto';

let controller = new AbortController();

function abort() {
	controller.abort();
	controller = new AbortController();
}

async function decrypt(data: Uint8Array, aesKey: CryptoKey) {
	return await decryptDataWithKey(data, aesKey, controller.signal)
		.inspectErr((err) => console.error(err))
		.unwrap();
}

async function encrypt(data: Uint8Array, aesKey: CryptoKey) {
	return await encryptDataWithKey(data, aesKey, controller.signal)
		.inspectErr((err) => console.error(err))
		.unwrap();
}

export { abort, decrypt, encrypt };
