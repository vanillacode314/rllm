import { Preset, defineConfig } from '@vite-pwa/assets-generator/config';

const preset = {
	transparent: { sizes: [64, 192, 512], favicons: [[48, 'favicon.ico']] },
	maskable: { sizes: [512] },
	apple: { sizes: [180] }
} satisfies Preset;
export default defineConfig({
	preset,
	images: ['public/favicon-flattened.svg']
});
