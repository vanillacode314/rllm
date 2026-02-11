import { generateSW } from 'workbox-build';

const BASE = 'dist';
generateSW({
	cacheId: 'rllm',
	cleanupOutdatedCaches: true,
	clientsClaim: true,
	globDirectory: BASE,
	globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}'],
	inlineWorkboxRuntime: true,
	navigateFallback: '/index.html',
	navigateFallbackDenylist: [/^\/api\/.*/, /^\/sw\.js/],
	sourcemap: false,
	additionalManifestEntries: ['manifest.json'],
	swDest: BASE + '/sw.js'
}).then(({ count, size, warnings }) => {
	if (warnings.length > 0) {
		console.warn('Warnings encountered while generating a service worker:', warnings.join('\n'));
	}
	console.log(
		`Generated a service worker, which will precache ${count} files, totaling ${size} bytes.`
	);
});
