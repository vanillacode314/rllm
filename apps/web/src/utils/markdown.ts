import { fromAsyncCodeToHtml } from '@shikijs/markdown-it/async'
import MarkdownItAsync from 'markdown-it-async'
import { codeToHtml } from 'shiki'

const md = MarkdownItAsync()

md.use(
  fromAsyncCodeToHtml(codeToHtml, {
    fallbackLanguage: 'markdown',
    themes: {
      light: 'vitesse-light',
      dark: 'vitesse-dark',
    },
  }),
)

export { md }
