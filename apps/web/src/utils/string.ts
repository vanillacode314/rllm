function isValidJSON(input: string) {
	try {
		JSON.parse(input);
		return true;
	} catch {
		return false;
	}
}

const slugify = (input: string) =>
	input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const dedent = (strings: TemplateStringsArray, ...values: unknown[]) => {
	const str = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');
	const lines = str.split('\n');
	const minIndent = Math.min(
		...lines
			.filter((line) => line.trim().length > 0)
			.map((line) => line.match(/^\s*/)?.[0].length ?? 0)
	);
	return lines.map((line) => line.slice(minIndent)).join('\n');
};

export { dedent, isValidJSON, slugify };
