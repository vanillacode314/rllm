import { defineConfig } from 'tsdown';

export default defineConfig({
  format: 'esm',
  shims: true,
  sourcemap: true,
  unbundle: true
});
