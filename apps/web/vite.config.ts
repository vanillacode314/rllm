import type { Plugin } from 'vite';

import { serwist } from '@serwist/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vite';
import { comlink } from 'vite-plugin-comlink';
import { compression } from 'vite-plugin-compression2';
import VitePluginDbg from 'vite-plugin-dbg';
import solidPlugin from 'vite-plugin-solid';

const sqlocal: Plugin = {
	name: 'configure-response-headers',
	configureServer: (server) => {
		server.middlewares.use((_req, res, next) => {
			res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
			res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
			next();
		});
	}
};

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		VitePluginDbg({
			enabled: process.env.NODE_ENV === 'development'
		}),
		AutoImport({
			include: [/\.[tj]sx?$/],
			dirs: [{ glob: './src/utils/debug.ts' }]
		}),
		comlink(),
		tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
		UnoCSS(),
		solidPlugin(),
		tailwindcss(),
		sqlocal,
		serwist({
			swSrc: 'src/sw.ts',
			swDest: 'sw.js',
			globDirectory: 'dist',
			injectionPoint: 'self.__SW_MANIFEST',
			rollupFormat: 'es',
			maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
			globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}']
			// additionalPrecacheEntries: ['manifest.json']
		}),
		compression({
			algorithms: ['gzip', 'brotli', 'zstd'],
			include: /\.(html|xml|css|json|js|mjs|svg|png|yaml|yml|toml|wasm|woff2|woff|ttf)$/
		})
	],
	worker: {
		format: 'es',
		plugins: () => [comlink()]
	},
	resolve: {
		alias: {
			'~': path.resolve(__dirname, './src'),
			'decode-named-character-reference': path.resolve(
				__dirname,
				'../../node_modules/decode-named-character-reference/index.js'
			),
			'hast-util-from-html-isomorphic': path.resolve(
				__dirname,
				'../../node_modules/hast-util-from-html-isomorphic/index.js'
			),
			'micromark-extension-math': 'micromark-extension-llm-math'
		}
	},
	optimizeDeps: {
		exclude: ['sqlocal']
	},
	server: {
		host: '0.0.0.0',
		allowedHosts: ['dev.homelab.lan']
	},
	build: {
		reportCompressedSize: false
	}
});
