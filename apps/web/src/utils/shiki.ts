import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'

const highlighter = await createHighlighterCore({
  themes: [
    () => import('@shikijs/themes/gruvbox-dark-hard'),
    () => import('@shikijs/themes/gruvbox-light-soft'),
  ],
  langs: [() => import('@shikijs/langs/json')],
  engine: createOnigurumaEngine(() => import('shiki/wasm')),
})

export { highlighter }
