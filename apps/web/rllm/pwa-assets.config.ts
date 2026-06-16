import { defineConfig, Preset } from '@vite-pwa/assets-generator/config';

const preset = {
	apple: { sizes: [180] },
	maskable: { sizes: [512] },
	transparent: { favicons: [[48, 'favicon.ico']], sizes: [64, 192, 512] }
} satisfies Preset;

export default defineConfig({
	images: ['public/logo.svg'],
	preset
});
