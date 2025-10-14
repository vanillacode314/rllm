function formatError(error: Error) {
	let result = `${error.message}`;
	const causes = [] as unknown[];
	let cause = error.cause;
	while (true) {
		if (cause) causes.push(cause);
		if (typeof cause !== 'object' || cause === null || !('cause' in cause)) break;
		cause = cause.cause;
	}
	if (causes.length === 0) return result;
	result += `\n\nCaused by:\n`;
	if (causes.length > 1) {
		for (let i = 0; i < causes.length; i++) {
			const cause = causes[i];
			if (cause instanceof Error) {
				result += `    ${i}: ${cause.message}`;
			} else {
				result += `    ${i}: ${causes[i]}`;
			}
			if (i < causes.length - 1) result += '\n';
		}
	} else {
		const cause = causes[0];
		if (cause instanceof Error) {
			result += `    ${cause.message}`;
		} else {
			result += `    ${cause}`;
		}
	}
	return result;
}

export { formatError };
