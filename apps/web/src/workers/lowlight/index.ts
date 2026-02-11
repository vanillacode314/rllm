import { ObjectPool } from 'object-pool';

export function makeNewLowlightWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
		type: 'module',
		name: 'starry-night'
	});
}

export const lowlightWorkerPool = new ObjectPool(
	makeNewLowlightWorker,
	navigator.hardwareConcurrency
);
