import { defineConfig } from 'tsdown';

export default defineConfig({
  clean: true,
  entry: ['src/**/*.{ts,tsx}'],
  format: 'esm',
  platform: 'browser',
  sourcemap: true,
  // onSuccess: 'tsc --emitDeclarationOnly --declaration',
  unbundle: true
});
