import { toHtml } from 'hast-util-to-html';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

export function codeToHtml(code: string, lang: string) {
	const tree = lowlight.highlight(lang, code);
	return toHtml(tree);
}
