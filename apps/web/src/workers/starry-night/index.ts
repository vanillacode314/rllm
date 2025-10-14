import { ObjectPool } from 'object-pool';

export function makeNewStarryNightWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
		type: 'module',
		name: 'starry-night'
	});
}

export const starryNightWorkerPool = new ObjectPool(
	makeNewStarryNightWorker,
	navigator.hardwareConcurrency
);
