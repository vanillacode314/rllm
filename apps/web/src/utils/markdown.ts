import { all } from 'lowlight';
// import { all } from '@wooorm/starry-night';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
// import rehypeStarryNight from 'rehype-starry-night';
import rehypeStringify from 'rehype-stringify';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { type PluggableList, unified } from 'unified';
// import onigUrl from 'vscode-oniguruma/release/onig.wasm?url';

import { dedent } from './string';

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
	[rehypeHighlight, { languages: all }]
	// [rehypeStarryNight, { grammars: all, getOnigurumaUrlFetch: () => onigUrl }]
] satisfies PluggableList;

const md = unified()
	.use(remarkParse)
	.use(remarkPlugins)
	.use(remarkRehype, { allowDangerousHtml: true })
	.use(rehypePlugins)
	.use(rehypeStringify);

export { md, rehypePlugins, remarkPlugins };
