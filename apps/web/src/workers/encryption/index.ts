import { ObjectPool } from 'object-pool';
export function makeNewEncryptionWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
		type: 'module',
		name: 'encryption'
	});
}

export const encryptionWorkerPool = new ObjectPool(
	makeNewEncryptionWorker,
	navigator.hardwareConcurrency
);

export async function decrypt(data: Uint8Array, key: CryptoKey) {
	const worker = await encryptionWorkerPool.get();
	let result;
	try {
		result = await worker.decrypt(data, key);
	} finally {
		encryptionWorkerPool.release(worker);
	}
	return result;
}

export async function encrypt(data: Uint8Array, key: CryptoKey) {
	const worker = await encryptionWorkerPool.get();
	let result;
	try {
		result = await worker.encrypt(data, key);
	} finally {
		encryptionWorkerPool.release(worker);
	}
	return result;
}
