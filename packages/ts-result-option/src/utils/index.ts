import { AsyncResult } from '~/async-result';
import { Err, Result } from '~/result';

function tryBlock<T, E>(
	f: () => AsyncGenerator<Err<unknown, E>, Result<T, E>>,
	onError: (e: unknown) => E
): AsyncResult<T, E>;
function tryBlock<T, E>(
	f: () => AsyncGenerator<Err<unknown, E>, void>,
	onError: (e: unknown) => E
): AsyncResult<void, E>;
function tryBlock<T, E>(
	f: () => Generator<Err<unknown, E>, Result<T, E>>,
	onError: (e: unknown) => E
): Result<T, E>;
function tryBlock<T, E>(
	f: () => Generator<Err<unknown, E>, void>,
	onError: (e: unknown) => E
): Result<void, E>;
function tryBlock<T, E>(
	f: () =>
		| AsyncGenerator<Err<unknown, E>, Result<T, E>>
		| AsyncGenerator<Err<unknown, E>, void>
		| Generator<Err<unknown, E>, Result<T, E>>
		| Generator<Err<unknown, E>, void>,
	onError: (e: unknown) => E
): AsyncResult<T, E> | AsyncResult<void, E> | Result<T, E> | Result<void, E> {
	const generator = f();
	if (Symbol.asyncIterator in generator) {
		return AsyncResult.fromPromise(
			() =>
				generator.next().then(async ({ done, value }) => {
					if (done) return value;
					return value;
				}),
			(e) => onError(e)
		) as AsyncResult<T, E> | AsyncResult<void, E>;
	} else {
		const { done, value } = generator.next();
		if (done) return value === undefined ? Result.Ok(undefined) : value;
		return value as Result<T, E>;
	}
}

export { tryBlock };
export * from './fetch';
export * from './json';
