import {
  type BundledLanguage,
  type BundledTheme,
  type CodeToHastOptions,
  codeToHtml as codeToHtmlNative,
} from 'shiki'

function codeToHtml(
  input: string,
  options: CodeToHastOptions<BundledLanguage, BundledTheme>,
) {
  return codeToHtmlNative(input, options)
}

export { codeToHtml }
