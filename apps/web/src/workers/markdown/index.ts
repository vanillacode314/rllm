export function makeNewMarkdownWorker() {
	return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url));
}
