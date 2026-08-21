import Epub from 'epubjs';
import JSZip from 'jszip';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { AsyncResult, Option, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { unified } from 'unified';
import { fromXml } from 'xast-util-from-xml';
import { select, selectAll } from 'xast-util-select';

import { makeRagAdapter } from './utils';

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
  'thead',
  'blockquote',
  'div',
  'span',
  'strong',
  'em',
  'b',
  'i'
];

const bodyHtmlToMarkdownProcessor = unified()
  .use(rehypeParse)
  .use(rehypeSanitize, {
    ...defaultSchema,
    tagNames: textTags
  })
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(remarkStringify);

function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

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

      const opfPath = yield* readFile('META-INF/container.xml')
        .map((xml) => fromXml(xml))
        .map((tree) => select('rootfile', tree)?.attributes?.['full-path']);

      if (!opfPath) {
        return Result.Err(new Error('No rootfile found in container.xml'));
      }

      // 2. Parse OPF file into XAST and select XHTML item hrefs
      const hrefs = yield* readFile(opfPath)
        .map((xml) => fromXml(xml))
        .map((tree) => selectAll('item', tree))
        .map((nodes) =>
          nodes
            .filter((node) => node.attributes?.['media-type'] === 'application/xhtml+xml')
            .map((node) => node.attributes?.['href'])
            .filter((href): href is string => Boolean(href))
        );

      if (hrefs.length === 0) {
        return Result.Err(new Error('No XHTML files found in manifest'));
      }

      const opfDir = opfPath.split('/').slice(0, -1).join('/');

      const htmlContents = await Promise.all(
        hrefs.map((href) =>
          tryBlock(
            async function* () {
              let path = opfDir ? `${opfDir}/${href}` : href;
              path = path.startsWith('/') ? path.slice(1) : path;
              const html = yield* readFile(path).map((xml) => extractBodyContent(xml));
              const content = String(await bodyHtmlToMarkdownProcessor.process(html));
              console.log('🪚 content:', content);
              return Result.Ok(content);
            },
            (e) => e
          )
        )
      );

      const text = (
        await Promise.all(htmlContents.map((content) => content.expect('should have content')))
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
    (e) => new Error(`Failed to parse epub file`, { cause: e })
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
      return Result.Ok(metadata.creator?.trim() || 'Unknown Author');
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
  getDescription: (file) =>
    tryBlock(
      async function* () {
        const buffer = await file.arrayBuffer();
        const title = yield* getEpubTitle(buffer);
        const author = yield* getEpubAuthor(buffer);
        return Result.Ok(`${title} by ${author}`);
      },
      (e) => new Error(`Failed to get description`, { cause: e })
    ),
  getText: (file) =>
    AsyncResult.from(
      async () => epubToString(await file.arrayBuffer()),
      (e) => new Error('Failed to get text from EPUB', { cause: e })
    ),
  id: 'epub'
});

export { epubRAGAdapter };
