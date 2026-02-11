import { ObjectPool } from 'object-pool';

export function makeNewMarkdownWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
		type: 'module',
		name: 'markdown'
	});
}

export const markdownWorkerPool = new ObjectPool(
	makeNewMarkdownWorker,
	navigator.hardwareConcurrency
);
