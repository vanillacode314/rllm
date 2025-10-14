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
