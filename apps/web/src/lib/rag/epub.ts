import Epub from 'epubjs';
import JSZip from 'jszip';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { AsyncResult, Option, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { unified } from 'unified';

import { makeRagAdapter } from './utils';

const xmlParser = new DOMParser();
const textTags = [
	'p',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ol',
	'ul',
	'li',
	'table',
	'td',
	'th',
	'tbody',
	'thead'
];
const sanitize = unified()
	.use(rehypeParse, { fragment: true })
	.use(rehypeSanitize, { tagNames: textTags })
	.use(rehypeRemark)
	.use(remarkGfm)
	.use(remarkStringify);

function epubToString(buffer: ArrayBuffer): AsyncResult<string, Error> {
	return tryBlock<string, Error>(
		async function* () {
			const zip = new JSZip();
			await zip.loadAsync(buffer);
			const readFile = AsyncResult.wrap(
				(path: string) =>
					Option.from(zip.file(path))
						.map((file) => file.async('text'))
						.unwrap(),
				(e, path) => new Error(`Failed to read file ${path}`, { cause: e })
			);
			const data = yield* readFile('META-INF/container.xml');
			const xml = xmlParser.parseFromString(data, 'text/xml');
			const opfPath = xml.querySelector('rootfile')?.getAttribute('full-path');
			if (!opfPath) return Result.Err(new Error('No rootfile found in container.xml'));
			const opf = yield* readFile(opfPath);
			const opfXml = xmlParser.parseFromString(opf, 'text/xml');
			const manifest = opfXml.querySelector('manifest');
			if (!manifest) return Result.Err(new Error('No manifest found in opf file'));
			const items = manifest.querySelectorAll('item');
			const htmlFiles = Array.from(items).filter(
				(item) => item.getAttribute('media-type') === 'application/xhtml+xml'
			);
			const htmlContents = await Promise.all(
				htmlFiles.map((item) =>
					tryBlock(
						async function* () {
							const href = yield* Option.from(item.getAttribute('href')).okOrElse(
								() => new Error('No href found in item')
							);
							let path = opfPath.split('/').slice(0, -1).join('/') + '/' + href;
							path = path.startsWith('/') ? path.slice(1) : path;
							const xml = yield* readFile(path);
							const content = xmlParser.parseFromString(xml, 'text/html').body.innerHTML;
							return Result.Ok(content);
						},
						(e) => e
					)
				)
			);

			const text = (
				await Promise.all(
					htmlContents
						.map((content) => content.expect('should have content'))
						.map(async (html) => String(await sanitize.process(html)))
				)
			)
				.join('\n\n')
				.replace(/\s+/g, (match) => {
					const numberOfNewLines = (match.match(/\n/g) || []).length;
					if (numberOfNewLines > 1) {
						return '\n\n';
					} else if (numberOfNewLines === 1) {
						return '\n';
					} else {
						return ' ';
					}
				});
			return Result.Ok(text);
		},
		(e) => new Error(`Failed to create zip`, { cause: e })
	);
}

function getEpubAuthor(buffer: ArrayBuffer): AsyncResult<string, Error> {
	return tryBlock(
		async function* () {
			const book = Epub(buffer);
			const metadata = yield* AsyncResult.from(
				() => book.loaded.metadata,
				(e) => new Error('Failed to load metadata', { cause: e })
			);
			return Result.Ok(metadata.creator.trim() || 'Unknown Author');
		},
		(e) => new Error(`Failed to get EPUB author`, { cause: e })
	);
}

function getEpubTitle(buffer: ArrayBuffer): AsyncResult<string, Error> {
	return tryBlock(
		async function* () {
			const book = Epub(buffer);
			const metadata = yield* AsyncResult.from(
				() => book.loaded.metadata,
				(e) => new Error('Failed to load metadata', { cause: e })
			);
			return Result.Ok(metadata.title);
		},
		(e) => new Error(`Failed to get EPUB title`, { cause: e })
	);
}

const epubRAGAdapter = makeRagAdapter({
	id: 'epub',
	getText: (file) =>
		AsyncResult.from(
			async () => epubToString(await file.arrayBuffer()),
			(e) => new Error('Failed to get text from EPUB', { cause: e })
		),
	getDescription: (file) =>
		tryBlock(
			async function* () {
				const buffer = await file.arrayBuffer();
				const title = yield* getEpubTitle(buffer);
				const author = yield* getEpubAuthor(buffer);
				return Result.Ok(`${title} by ${author}`);
			},
			(e) => new Error(`Failed to get description`, { cause: e })
		)
});

export { epubRAGAdapter };
