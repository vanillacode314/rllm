import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { md, rehypePlugins, remarkPlugins } from '~/utils/markdown';

const processor = unified()
	.use(remarkParse)
	.use(remarkPlugins)
	.use(remarkRehype)
	.use(rehypePlugins);
async function parse(input: string) {
	return processor.run(processor.parse(input), input);
}

async function render(input: string) {
	return String(await md.process(input));
}

export { parse, render };
