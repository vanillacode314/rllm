import type { Element } from "hast";

/**
 * Return the language string from a <code> element's className.
 * Expected format: class="language-js other‑class"
 */
export function getLangFromCodeNode(node: Element): string {
  const className = node.properties?.className;
  if (!className) return "";
  const classes = Array.isArray(className)
    ? className
    : (className as string).split(/\s+/);
  for (const c of classes) {
    if (typeof c === "string" && c.startsWith("language-")) {
      return c.replace(/^language-/, "");
    }
  }
  return "";
}

/**
 * Pull the plain text out of a <code> node.
 * The <code> node may have several text children
 */
export function getCodeFromNode(node: Element): string {
  if (!node.children) return "";
  let code = "";
  for (const child of node.children) {
    if (child.type !== "text") continue;
    code += child.value;
  }
  return code;
}
