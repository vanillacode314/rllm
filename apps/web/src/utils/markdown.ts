import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { rehypeHighlight } from 'rehype-shiki';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { bundledLanguagesInfo, codeToHtml } from 'shiki';
import { unified } from 'unified';

const LANGS = new Set(bundledLanguagesInfo.map((lang) => lang.id));
const LANG_ALIASES = new Map([
	['bash', 'shellscript'],
	['javascriptreact', 'jsx'],
	['js', 'javascript'],
	['sh', 'shellscript'],
	['shell', 'shellscript'],
	['ts', 'typescript'],
	['typescriptreact', 'tsx']
]);

const md = unified()
	.use(remarkParse, { ht: true })
	.use(remarkGfm)
	.use(remarkDirective)
	.use(remarkMath)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypeRaw)
	.use(rehypeSanitize)
	.use(rehypeKatex)
	.use(rehypeHighlight, {
		codeToHtml: (code: string, lang: string) => {
			const alias = LANG_ALIASES.get(lang);
			if (alias) console.debug(`[RehypeHighlight] Using alias ${alias} for ${lang}`);

			lang = alias || lang;
			const hasLang = LANGS.has(lang);
			if (!hasLang)
				console.debug(`[RehypeHighlight] Language ${lang} not supported, falling back to text`);

			return codeToHtml(code, {
				lang: hasLang ? lang : 'text',
				themes: {
					dark: 'vitesse-dark',
					light: 'vitesse-light'
				},
				transformers: [
					{
						pre(node) {
							this.addClassToHast(node, 'border border-secondary relative');
						}
					}
				]
			});
		}
	})
	.use(rehypeStringify);

export { md };
