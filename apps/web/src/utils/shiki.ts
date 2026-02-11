import { createHighlighterCore } from 'shiki/core';
import { createOnigurumaEngine } from 'shiki/engine/oniguruma';

const highlighter = await createHighlighterCore({
	themes: [
		() => import('@shikijs/themes/vitesse-dark'),
		() => import('@shikijs/themes/vitesse-light')
	],
	langs: [() => import('@shikijs/langs/json')],
	engine: createOnigurumaEngine(() => import('shiki/wasm'))
});

export { highlighter };
