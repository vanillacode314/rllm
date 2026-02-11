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
	return lines
		.map((line) => line.slice(minIndent))
		.join('\n')
		.trim();
};

interface TextSplitterOptions {
	chunkOverlap?: number;
	chunkSize?: number;
	cleanWhitespace?: boolean;
	separators?: string[];
}

class IterativeTextSplitter {
	private chunkOverlap: number;
	private chunkSize: number;
	private cleanWhitespace: boolean;
	private separators: string[];

	constructor(options: TextSplitterOptions = {}) {
		this.chunkSize = options.chunkSize || 1000;
		this.chunkOverlap = options.chunkOverlap || 200;
		this.separators = options.separators || ['\n\n', '\n', ' ', ''];
		this.cleanWhitespace = options.cleanWhitespace ?? false;
	}

	splitText(text: string): string[] {
		const chunks: string[] = [];
		let currentChunk = '';
		let i = 0;

		while (i < text.length) {
			let foundSplit = false;

			for (const separator of this.separators) {
				if (separator === '') {
					continue;
				}

				const nextSeparatorIndex = text.indexOf(separator, i);

				if (nextSeparatorIndex !== -1 && nextSeparatorIndex - i <= this.chunkSize) {
					const segment = text.substring(i, nextSeparatorIndex + separator.length);

					if (currentChunk.length + segment.length <= this.chunkSize) {
						currentChunk += segment;
					} else {
						if (currentChunk) {
							chunks.push(this.cleanWhitespace ? currentChunk.trim() : currentChunk);
							if (this.chunkOverlap > 0 && currentChunk.length > this.chunkOverlap) {
								currentChunk = currentChunk.substring(currentChunk.length - this.chunkOverlap);
							} else {
								currentChunk = '';
							}
						}
						currentChunk = segment;
					}

					i = nextSeparatorIndex + separator.length;
					foundSplit = true;
					break;
				}
			}

			if (!foundSplit) {
				const remaining = text.length - i;
				const segmentLength = Math.min(remaining, this.chunkSize - currentChunk.length);
				const segment = text.substring(i, i + segmentLength);
				currentChunk += segment;
				i += segmentLength;

				if (currentChunk.length >= this.chunkSize || i >= text.length) {
					chunks.push(this.cleanWhitespace ? currentChunk.trim() : currentChunk);
					if (this.chunkOverlap > 0 && currentChunk.length > this.chunkOverlap) {
						currentChunk = currentChunk.substring(currentChunk.length - this.chunkOverlap);
					} else {
						currentChunk = '';
					}
				}
			}
		}

		if (currentChunk) {
			chunks.push(this.cleanWhitespace ? currentChunk.trim() : currentChunk);
		}

		return chunks;
	}
}

export function extractFirstJson(text: string) {
	const jsonRegex = /(?:{(?:[^{}]|"\\."|"[^"]*")*}|\[(?:[^[\]]|"\\."|"[^"]*")*\])/;
	const match = text.match(jsonRegex);

	if (!match) {
		throw new Error('No JSON found in the text');
	}

	const jsonString = match[0];
	return jsonString;
}

export function snakeCaseToCamelCase(input: string) {
	return input.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export { dedent, isValidJSON, IterativeTextSplitter, slugify };
