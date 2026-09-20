import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
  clean: !options.watch,
  dts: { sourcemap: true },
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'neutral',
  sourcemap: true,
  target: 'es2022',
  tsconfig: 'tsconfig.json'
}));
