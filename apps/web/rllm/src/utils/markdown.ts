import { toString } from 'hast-util-to-string';
import { common, createLowlight } from 'lowlight';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import type { PluggableList } from 'unified';
import { visit } from 'unist-util-visit';

import { produce } from './immer';
import { dedent } from './string';

const lowlight = createLowlight(common);

const grammarLoaders = import.meta.glob<any>('/node_modules/highlight.js/lib/languages/*.js');
const loadedGrammars = new Set(lowlight.listLanguages());
const pendingImports = new Map<string, Promise<void>>();

async function loadGrammar(lang: string): Promise<void> {
  if (loadedGrammars.has(lang)) return;
  if (pendingImports.has(lang)) return pendingImports.get(lang);

  const pathKey = `/node_modules/highlight.js/lib/languages/${lang}.js`;
  const loader = grammarLoaders[pathKey];

  if (!loader) {
    loadedGrammars.add(lang); // Prevent retrying unknown languages
    return;
  }

  const importPromise = (async () => {
    try {
      const module = await loader();
      lowlight.register(lang, module.default);
      loadedGrammars.add(lang);
    } catch {
      loadedGrammars.add(lang); // Prevent hanging on bad network/file
    } finally {
      pendingImports.delete(lang);
    }
  })();

  pendingImports.set(lang, importPromise);
  return importPromise;
}

function rehypeDynamicHighlight() {
  return async (tree: any) => {
    const codeNodes: { lang: string; node: any }[] = [];

    visit(tree, 'element', (node: any, _index: number | undefined, parent: any) => {
      if (node.tagName === 'code' && parent?.tagName === 'pre') {
        const className = node.properties?.className || [];
        const langClass = Array.from(className).find(
          (c): c is string => typeof c === 'string' && c.startsWith('language-')
        );
        if (langClass) {
          const lang = langClass.replace('language-', '').toLowerCase();
          codeNodes.push({ lang, node });
        }
      }
    });

    if (codeNodes.length === 0) return;

    const missingLangs = Array.from(
      new Set(codeNodes.map((item) => item.lang).filter((lang) => !loadedGrammars.has(lang)))
    );

    if (missingLangs.length > 0) {
      await Promise.all(missingLangs.map(loadGrammar));
    }

    for (const { lang, node } of codeNodes) {
      const codeText = toString(node);
      if (!codeText) continue;

      try {
        if (lowlight.registered(lang)) {
          const highlightedAst = lowlight.highlight(lang, codeText);
          node.children = highlightedAst.children;
        }
      } catch {
        // Fall back to plain text on error
      }
    }
  };
}

function remarkDedentCodeBlocks() {
  return (tree: any) => {
    visit(tree, 'code', (node: any) => {
      if (node.value) {
        node.value = dedent`${node.value}`;
      }
    });
  };
}

const remarkPlugins = [
  remarkDedentCodeBlocks,
  remarkGfm,
  [remarkMath, { singleDollarTextMath: false }]
] satisfies PluggableList;

const sanitizeSchema = produce(defaultSchema, (draft) => {
  draft.tagNames?.push('mention-src');
  if (draft.attributes) {
    draft.attributes['mention-src'] = ['dataDocumentId', 'dataId', 'dataType', 'dataHref'];
  }
});

const rehypePlugins = [
  rehypeRaw,
  [rehypeSanitize, sanitizeSchema],
  rehypeKatex,
  rehypeDynamicHighlight
] satisfies PluggableList;

export { rehypePlugins, remarkPlugins };
