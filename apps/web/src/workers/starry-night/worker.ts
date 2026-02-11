import { all, createStarryNight } from '@wooorm/starry-night';
import { toHtml } from 'hast-util-to-html';

const starryNight = await createStarryNight(all);

export function codeToHtml(code: string, lang: string) {
	const scope = starryNight.flagToScope(lang);
	if (!scope) return code;
	const tree = starryNight.highlight(code, scope);
	return toHtml(tree);
}
