import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

// import { defaultCache } from '@serwist/vite/worker';
import { disableNavigationPreload, Serwist } from 'serwist';

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
  clientsClaim: true,
  precacheEntries: self.__SW_MANIFEST,
  // TODO: figure this out later
  // runtimeCaching: defaultCache,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 20,
    navigateFallback: '/index.html',
    navigateFallbackDenylist: [/^\/api\/.*/, /^\/sw\.js/]
  },
  skipWaiting: false
});

// Navigation preload must stay off: Serwist's PrecacheStrategy returns `event.preloadResponse`
// (the network response) before it consults the precache, so an enabled preload turns every
// navigation into a network round trip instead of serving the cached index.html. The flag lives on
// the registration, not the worker, and Serwist only ever *enables* it — so it has to be explicitly
// disabled for installs that already have it on.
disableNavigationPreload();

serwist.addEventListeners();
