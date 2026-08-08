import { defineConfig } from 'tsdown';

export default defineConfig(options => ({
  clean: !options.watch,
  entry: 'src/**/*.ts',
  format: 'esm',
  dts: true,
  platform: 'neutral',
  sourcemap: true,
}));
