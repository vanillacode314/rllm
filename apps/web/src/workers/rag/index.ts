import { ObjectPool } from 'object-pool';

export function makeNewRagWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
		type: 'module',
		name: 'rag'
	});
}

export const ragWorkerPool = new ObjectPool(makeNewRagWorker, navigator.hardwareConcurrency, 100);
