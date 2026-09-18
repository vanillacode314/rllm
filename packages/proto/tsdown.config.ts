import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
  clean: !options.watch,
  dts: true,
  // One published file per proto package. Each entry is a barrel re-exporting
  // every generated module of that package, so the bundle inlines them all.
  entry: ['src/ts/peers/v1/index.ts', 'src/ts/events/v1/index.ts'],
  format: 'esm',
  minify: false,
  platform: 'neutral',
  sourcemap: true,
  unbundle: false
}));
