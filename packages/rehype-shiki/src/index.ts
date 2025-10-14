import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";
import { getLangFromCodeNode, getCodeFromNode } from "./utils";
import { fromHtml } from "hast-util-from-html";

export type HighlightAsyncOptions = {
  codeToHtml: (code: string, lang: string) => string | Promise<string>;
};

export function rehypeHighlight(opts: HighlightAsyncOptions) {
  const { codeToHtml } = opts;

  return async (tree: Root) => {
    const replacements: Array<Promise<void>> = [];

    visit(tree, "element", (node: Element, index?: number, parent?: any) => {
      if (!parent || typeof index !== "number") return;
      if (
        node.tagName !== "pre" ||
        !node.children?.[0] ||
        node.children[0].type !== "element"
      )
        return;

      const codeNode = node.children[0] as Element;
      if (codeNode.tagName !== "code") return;

      const lang = getLangFromCodeNode(codeNode);
      const code = getCodeFromNode(codeNode);

      const p = (async () => {
        const highlighted = await codeToHtml(code, lang);
        const highlightedTree = fromHtml(highlighted, { fragment: true });
        parent.children.splice(index, 1, ...highlightedTree.children);
      })();

      replacements.push(p);
    });

    await Promise.all(replacements);
  };
}
