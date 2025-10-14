function isValidJSON(input: string) {
	try {
		JSON.parse(input);
		return true;
	} catch (e) {
		return false;
	}
}

const slugify = (input: string) =>
	input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export { isValidJSON, slugify };
