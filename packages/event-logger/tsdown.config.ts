import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: true,
	entry: ['src/**/*.ts'],
	format: 'esm',
	onSuccess: 'tsc --emitDeclarationOnly --declaration',
	platform: 'browser',
	sourcemap: true
});
