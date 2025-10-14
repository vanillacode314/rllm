function d<T>(arg: T): T;
function d<T extends unknown[]>(...args: T): T;
function d<T extends unknown[]>(...args: T): T | T[number] {
	console.log(...args);
	return args.length === 1 ? args[0] : args;
}

function dt<T>(arg: T): T;
function dt<T extends unknown[]>(...args: T): T;
function dt<T extends unknown[]>(...args: T): T | T[number] {
	console.trace(...args);
	return args.length === 1 ? args[0] : args;
}

function timePromise<TArgs extends unknown[], T>(
	message: string,
	fn: (...args: TArgs) => Promise<T>
): (...args: NoInfer<TArgs>) => Promise<T> {
	return async (...args: TArgs) => {
		const start = Date.now();
		const result = await fn(...args);
		const end = Date.now();
		console.log(`${message} took ${end - start}ms`);
		return result;
	};
}

export { d, dt, timePromise };
