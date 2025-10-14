import { all } from '@wooorm/starry-night';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStarryNight from 'rehype-starry-night';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { bundledLanguagesInfo, codeToHtml } from 'shiki';
import { type PluggableList, unified } from 'unified';
import onigUrl from 'vscode-oniguruma/release/onig.wasm?url';

import { dedent } from './string';

const LANGS = new Set(bundledLanguagesInfo.map((lang) => lang.id.toLowerCase()));
const LANG_ALIASES = new Map(
	Object.entries({
		bash: 'shellscript',
		javascriptreact: 'jsx',
		js: 'javascript',
		sh: 'shellscript',
		shell: 'shellscript',
		ts: 'typescript',
		typescriptreact: 'tsx'
	})
);
const myCodeToHtml = (code: string, lang: string) => {
	lang = lang.toLowerCase();
	const alias = LANG_ALIASES.get(lang);
	if (alias) console.debug(`[RehypeHighlight] Using alias ${alias} for ${lang}`);

	lang = alias || lang;
	const hasLang = LANGS.has(lang);
	if (!hasLang)
		console.debug(`[RehypeHighlight] Language ${lang} not supported, falling back to text`);

	return codeToHtml(dedent`${code}`, {
		lang: hasLang ? lang : 'text',
		themes: {
			dark: 'vitesse-dark',
			light: 'vitesse-light'
		}
	});
};

function remarkDedentCodeBlocks() {
	return (tree) => {
		tree.children.forEach((node) => {
			if (node.type === 'code') {
				node.value = dedent`${node.value}`;
			}
		});
	};
}
const remarkPlugins = [
	remarkDedentCodeBlocks,
	remarkGfm,
	remarkDirective,
	remarkMath
] satisfies PluggableList;

const rehypePlugins = [
	rehypeRaw,
	rehypeSanitize,
	rehypeKatex,
	[rehypeStarryNight, { grammars: all, getOnigurumaUrlFetch: () => onigUrl }]
] satisfies PluggableList;

const md = unified()
	.use(remarkParse)
	.use(remarkPlugins)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypePlugins)
	.use(rehypeStringify);

export { md, rehypePlugins, remarkPlugins };
