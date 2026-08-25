import { serwist } from '@serwist/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';
import sqlocalPlugin from 'sqlocal/vite';
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig, type PluginOption, type UserConfig } from 'vite';
import { comlink } from 'vite-plugin-comlink';
import { compression } from 'vite-plugin-compression2';
import solidPlugin from 'vite-plugin-solid';
// oxlint-disable perfectionist/sort-objects
import wasm from 'vite-plugin-wasm';

import pkgJson from './package.json' with { type: 'json' };

function stubSerwistPlugin(): PluginOption {
  const virtualModuleId = 'virtual:serwist';
  const resolvedVirtualModuleId = '\0' + virtualModuleId;

  return {
    name: 'stub-serwist',
    resolveId(id) {
      if (id === virtualModuleId) return resolvedVirtualModuleId;
    },
    load(id) {
      if (id === resolvedVirtualModuleId) {
        // Return dummy exports matching what your code imports
        return 'export const serwist = null; export default {};';
      }
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const config: UserConfig = {
    build: {
      reportCompressedSize: false
      // sourcemap: true
    },
    define: {
      __VERSION__: JSON.stringify(pkgJson.version)
    },
    resolve: {
      alias: {
        // 'decode-named-character-reference': path.resolve(
        //   import.meta.dirname,
        //   '../../../node_modules/decode-named-character-reference/index.js'
        // ),
        // 'hast-util-from-html-isomorphic': path.resolve(
        //   import.meta.dirname,
        //   '../../../node_modules/hast-util-from-html-isomorphic/index.js'
        // ),
        '~/db/client':
          mode === 'android'
            ? path.resolve(import.meta.dirname, './src/db/client.platform.android.ts')
            : path.resolve(import.meta.dirname, './src/db/client.platform.web.ts'),
        '~/lib/vector-db/client':
          mode === 'android'
            ? path.resolve(import.meta.dirname, './src/lib/vector-db/client.platform.android.ts')
            : path.resolve(import.meta.dirname, './src/lib/vector-db/client.platform.web.ts'),
        '~/lib/vector-db/transient':
          mode === 'android'
            ? path.resolve(import.meta.dirname, './src/lib/vector-db/transient.platform.android.ts')
            : path.resolve(import.meta.dirname, './src/lib/vector-db/transient.platform.web.ts'),
        '~': path.resolve(import.meta.dirname, './src')
      }
    },
    server: {
      allowedHosts: ['dev.h.raqueeb.com'],
      host: '0.0.0.0'
    },
    worker: {
      format: 'es',
      plugins: () => [comlink()]
    }
  };

  const plugins: PluginOption[] = [
    // analyzer(),
    wasm(),
    AutoImport({
      dirs: [{ glob: './src/utils/debug.ts' }],
      include: [/\.[tj]sx?$/]
    }),
    comlink(),
    tanstackRouter({ autoCodeSplitting: true, target: 'solid' }),
    UnoCSS(),
    solidPlugin(),
    tailwindcss()
  ];

  if (mode === 'web') {
    plugins.push(
      sqlocalPlugin(),
      serwist({
        globDirectory: 'dist',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,wasm}'],
        injectionPoint: 'self.__SW_MANIFEST',
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
        rollupFormat: 'es',
        swDest: 'sw.js',
        swSrc: 'src/sw.ts'
        // additionalPrecacheEntries: ['manifest.json']
      }),
      compression({
        algorithms: ['brotli'],
        include: /\.(html|xml|css|json|js|mjs|svg|png|yaml|yml|toml|wasm|woff2|woff|ttf)$/
      })
    );
  }

  if (mode === 'android') {
    plugins.push(stubSerwistPlugin());
  }

  Object.assign(config, { plugins });

  return config;
});
