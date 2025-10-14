import Epub from 'epubjs';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import rehypeSanitize from 'rehype-sanitize';
import remarkStringify from 'remark-stringify';
import { Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { unified } from 'unified';

import type { TRAGAdapter } from './types';

const sanitize = unified()
	.use(rehypeParse)
	.use(rehypeSanitize)
	.use(rehypeRemark)
	.use(remarkStringify);

export async function epubToString(buffer: ArrayBuffer): Promise<string[]> {
	const book = Epub(buffer);
	await book.ready;

	const promises = [] as Promise<string>[];
	book.spine.each((section) => {
		promises.push(
			section.load(book.load.bind(book)).then(async (section: Element) => {
				const content = section.innerHTML;
				const sanitizedContent = String(await sanitize.process(content));
				return sanitizedContent;
			})
		);
	});
	const parts = await Promise.all(promises);

	return parts;
}

const epubRAGAdapter = {
	id: 'epub',
	handleFile: (file) =>
		tryBlock(
			async function* () {
				const content = await epubToString(await file.arrayBuffer());
				console.log('content', content);
				return Result.Ok({
					title: 'x',
					content: content.join('...')
				});
			},
			(e) => new Error(`Failed to parse EPUB`, { cause: e })
		)
} satisfies TRAGAdapter;

export { epubRAGAdapter };
