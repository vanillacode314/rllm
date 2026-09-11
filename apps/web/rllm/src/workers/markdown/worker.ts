import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { VFile } from 'vfile';

import { rehypePlugins, remarkPlugins } from '~/utils/markdown';

const processor = unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypePlugins);

async function parse(file: VFile) {
  return processor.run(processor.parse(file), file);
}

export { parse };
