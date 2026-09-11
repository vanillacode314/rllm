import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { VFile } from 'vfile';

import { rehypePlugins, remarkPlugins } from '~/utils/markdown';

const processor = unified()
  .use(remarkParse)
  .use(remarkPlugins)
  .use(remarkRehype)
  .use(rehypePlugins);

async function parse(file: VFile) {
  return processor.runSync(processor.parse(file), file);
}

export { parse };
