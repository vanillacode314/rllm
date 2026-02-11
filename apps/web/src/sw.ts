import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

// import { defaultCache } from '@serwist/vite/worker';
import { Serwist } from 'serwist';

// This declares the value of `injectionPoint` to TypeScript.
// `injectionPoint` is the string that will be replaced by the
// actual precache manifest. By default, this string is set to
// `"self.__SW_MANIFEST"`.
declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
	cacheId: 'rllm',
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: false,
	clientsClaim: true,
	navigationPreload: true,
	// TODO: figure this out later
	// runtimeCaching: defaultCache,
	precacheOptions: {
		cleanupOutdatedCaches: true,
		concurrency: 20,
		navigateFallback: '/index.html',
		navigateFallbackDenylist: [/^\/api\/.*/, /^\/sw\.js/]
	}
});

serwist.addEventListeners();
