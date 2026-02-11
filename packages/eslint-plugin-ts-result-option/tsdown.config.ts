import { defineConfig } from 'tsdown'

export default defineConfig({
  format: 'esm',
  unbundle: true,
  sourcemap: true,
  shims: true,
})
