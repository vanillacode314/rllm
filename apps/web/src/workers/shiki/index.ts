import { ObjectPool } from 'object-pool';

export function makeNewShikiWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
		type: 'module',
		name: 'shiki'
	});
}

export const shikiWorkerPool = new ObjectPool(makeNewShikiWorker, navigator.hardwareConcurrency);
