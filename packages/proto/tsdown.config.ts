import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
  clean: !options.watch,
  dts: true,
  entry: 'src/**/*.ts',
  format: 'esm',
  minify: false,
  platform: 'neutral',
  sourcemap: true,
  unbundle: true
}));
