import { md } from '~/utils/markdown';

async function render(input: string) {
	return String(await md.process(input));
}

export { render };
