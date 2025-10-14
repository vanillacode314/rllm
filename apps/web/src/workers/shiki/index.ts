export function makeNewShikiWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url));
}
