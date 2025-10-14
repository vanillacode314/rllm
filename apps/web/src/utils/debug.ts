function d<const T>(arg: T): T;
function d<const T extends unknown[]>(...args: T): T;
function d<const T extends unknown[]>(...args: T): T | T[number] {
	console.log(...args);
	return args.length === 1 ? args[0] : args;
}

function dt<T>(arg: T): T;
function dt<T extends unknown[]>(...args: T): T;
function dt<T extends unknown[]>(...args: T): T | T[number] {
	console.trace(...args);
	return args.length === 1 ? args[0] : args;
}

function timePromise<Fn extends (...args: never[]) => Promise<never>>(message: string, fn: Fn): Fn {
	const wrapped = (async (...args) => {
		const start = performance.now();
		const result = await fn(...args);
		const end = performance.now();
		console.log(`${message} took ${end - start}ms`);
		return result;
	}) as Fn;
	return wrapped;
}

export { d, dt, timePromise };
