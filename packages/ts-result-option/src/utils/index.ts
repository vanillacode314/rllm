import { AsyncResult } from '~/async-result';
import { Result } from '~/result';

function tryBlock<T, E>(
	f: () => AsyncGenerator<Result<never, E>, Result<T, E>>,
	onError: (e: unknown) => E
): AsyncResult<T, E>;
function tryBlock<E>(
	f: () => AsyncGenerator<Result<never, E>, void>,
	onError: (e: unknown) => E
): AsyncResult<void, E>;
function tryBlock<T, E>(
	f: () => Generator<Result<never, E>, Result<T, E>>,
	onError: (e: unknown) => E
): Result<T, E>;
function tryBlock<E>(
	f: () => Generator<Result<never, E>, void>,
	onError: (e: unknown) => E
): Result<void, E>;
function tryBlock<T, E>(
	f: () =>
		| AsyncGenerator<Result<never, E>, Result<T, E> | void>
		| Generator<Result<never, E>, Result<T, E> | void>,
	onError: (e: unknown) => E
): AsyncResult<T | void, E> | Result<T | void, E> {
	const generator = f();
	if (Symbol.asyncIterator in generator) {
		return AsyncResult.from(() => generator.next().then(({ value }) => value), onError) as
			| AsyncResult<T, E>
			| AsyncResult<void, E>;
	} else {
		try {
			const { value } = generator.next();
			return value === undefined ? Result.Ok(undefined) : (value as Result<T, E>);
		} catch (e) {
			return Result.Err<T, E>(onError(e));
		}
	}
}

export { tryBlock };
export * from './fetch';
export * from './json';
