function cosineSimilarity(a: number[], b: number[]): number {
	const normalizedA = normalizeVector(a);
	const normalizedB = normalizeVector(b);

	let dotProduct = 0;
	for (let i = 0; i < normalizedA.length; i++) {
		dotProduct += normalizedA[i] * normalizedB[i];
	}

	return dotProduct;
}

function normalizeVector(vector: number[]): number[] {
	const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
	return vector.map((val) => val / magnitude);
}

function randomFloat({ min = 0, max = 1 }: { max?: number; min?: number } = {}) {
	return Math.random() * (max - min) + min;
}

function round(n: number, precision: number) {
	const factor = Math.pow(10, precision);
	return Math.round(n * factor) / factor;
}

export { cosineSimilarity, randomFloat, round };
