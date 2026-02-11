import { defineConfig } from 'tsdown';

export default defineConfig((options) => ({
	clean: !options.watch,
	entry: ['src/**/*.ts'],
	format: 'esm',
	dts: true,
	unbundle: true,
	minify: false,
	platform: 'neutral',
	sourcemap: true
}));
