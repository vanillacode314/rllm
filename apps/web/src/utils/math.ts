function randomFloat({ min = 0, max = 1 }: { max?: number; min?: number } = {}) {
	return Math.random() * (max - min) + min;
}

function round(n: number, precision: number) {
	const factor = Math.pow(10, precision);
	return Math.round(n * factor) / factor;
}

export { randomFloat, round };
