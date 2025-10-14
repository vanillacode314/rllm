function once<Fn extends (...args: never[]) => never>(fn: Fn): Fn {
	let called = false;
	let result: ReturnType<Fn>;
	return function (...args) {
		if (!called) {
			called = true;
			result = fn(...args);
		}
		return result;
	} as Fn;
}

export { once };
