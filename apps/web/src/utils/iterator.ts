const itertools = {
	*chain<T>(a: Iterable<T>, b: Iterable<T>): Iterable<T> {
		yield* a;
		yield* b;
	},
	*once<T>(value: T): Iterable<T> {
		yield value;
	}
};

export { itertools };
