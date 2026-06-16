import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import { defineConfig, presetWebFonts } from 'unocss'

export default defineConfig({
  presets: [
    presetWebFonts({
      fonts: {
        mono: ['Fira Code', 'Courier New'],
        sans: ['Geist:400,500,600,700', 'Lora:400,500,600,700'],
      },
      processors: createLocalFontProcessor({
        cacheDir: 'node_modules/.cache/unocss/fonts',
        fontAssetsDir: 'public/assets/fonts',
        fontServeBaseUrl: '/assets/fonts',
      }),
      provider: 'bunny',
    }),
  ],
})
