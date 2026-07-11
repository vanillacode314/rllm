// oxlint-disable perfectionist/sort-objects
import { exec, execSync } from 'node:child_process';
import { serwist } from '@serwist/vite';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import path from 'node:path';
import sqlocalPlugin from 'sqlocal/vite';
import UnoCSS from 'unocss/vite';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig, type PluginOption } from 'vite';
import { comlink } from 'vite-plugin-comlink';
import { compression } from 'vite-plugin-compression2';
import VitePluginDbg from 'vite-plugin-dbg';
import solidPlugin from 'vite-plugin-solid';
import fs from 'node:fs';

import pkgJson from './package.json' with { type: 'json' };

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: PluginOption[] = [
    // analyzer(),
    VitePluginDbg({
      enabled: process.env.NODE_ENV === 'development'
    }),
    AutoImport({
      dirs: [{ glob: './src/utils/debug.ts' }],
      include: [/\.[tj]sx?$/]
    }),
    comlink(),
    tanstackRouter({ autoCodeSplitting: true, target: 'solid', enableRouteGeneration: true }),
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

  const webOnlyRoutes = ['settings/proxy'];

  if (mode === 'android') {
    plugins.push({
      name: 'exclude-web-only-routes',
      enforce: 'pre', // before tanstackRouter
      buildStart() {
        webOnlyRoutes.forEach((name) => {
          const filepath = path.resolve(__dirname, `src/routes/${name}.tsx`);
          const filename = path.basename(filepath);
          const ignoredFilename = `-${filename}.ignored`;
          const ignoredFilepath = path.resolve(filepath, '..', ignoredFilename);
          if (fs.existsSync(filepath)) fs.renameSync(filepath, ignoredFilepath);
        });
        execSync('npm run generate:routes');
      },
      buildEnd() {
        webOnlyRoutes.forEach((name) => {
          const filepath = path.resolve(__dirname, `src/routes/${name}.tsx`);
          const filename = path.basename(filepath);
          const ignoredFilename = `-${filename}.ignored`;
          const ignoredFilepath = path.resolve(filepath, '..', ignoredFilename);
          if (fs.existsSync(ignoredFilepath)) fs.renameSync(ignoredFilepath, filepath);
        });
      }
    });
  }

  return {
    build: {
      reportCompressedSize: false
      // sourcemap: true
    },
    define: {
      __VERSION__: JSON.stringify(pkgJson.version)
    },
    plugins,
    resolve: {
      alias: {
        'decode-named-character-reference': path.resolve(
          __dirname,
          '../../../node_modules/decode-named-character-reference/index.js'
        ),
        'hast-util-from-html-isomorphic': path.resolve(
          __dirname,
          '../../../node_modules/hast-util-from-html-isomorphic/index.js'
        ),
        'micromark-extension-math': 'micromark-extension-llm-math',
        '~/lib/proxy':
          mode === 'android'
            ? path.resolve(__dirname, './src/lib/proxy.platform.android.ts')
            : path.resolve(__dirname, './src/lib/proxy.platform.web.ts'),
        '~/db/client':
          mode === 'android'
            ? path.resolve(__dirname, './src/db/client.platform.android.ts')
            : path.resolve(__dirname, './src/db/client.platform.web.ts'),
        '~': path.resolve(__dirname, './src')
      }
    },
    server: {
      allowedHosts: ['dev.homelab.lan'],
      host: '0.0.0.0'
    },
    worker: {
      format: 'es',
      plugins: () => [comlink()]
    }
  };
});
