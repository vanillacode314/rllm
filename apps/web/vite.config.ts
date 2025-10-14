import type { Plugin } from 'vite';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';
import { comlink } from 'vite-plugin-comlink';
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
		comlink(),
		tanstackRouter({ target: 'solid', autoCodeSplitting: true }),
		UnoCSS(),
		solidPlugin(),
		tailwindcss(),
		sqlocal
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
		proxy: {
			'/api': 'http://localhost:3002'
		}
	}
});
