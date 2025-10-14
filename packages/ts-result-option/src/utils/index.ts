import { AsyncResult } from '~/async-result';
import { Result } from '~/result';

// Overloads with explicit this context
function tryBlock<This, T, E>(
	thisArg: This,
	f: (this: This) => AsyncGenerator<Result<never, E>, Result<T, E>>,
	onError: (e: unknown) => E
): AsyncResult<T, E>;
function tryBlock<This, E>(
	thisArg: This,
	f: (this: This) => AsyncGenerator<Result<never, E>, void>,
	onError: (e: unknown) => E
): AsyncResult<void, E>;
function tryBlock<This, T, E>(
	thisArg: This,
	f: (this: This) => Generator<Result<never, E>, Result<T, E>>,
	onError: (e: unknown) => E
): Result<T, E>;
function tryBlock<This, E>(
	thisArg: This,
	f: (this: This) => Generator<Result<never, E>, void>,
	onError: (e: unknown) => E
): Result<void, E>;

// Overloads with explicit this context and optional onError
function tryBlock<This, T>(
	thisArg: This,
	f: (this: This) => AsyncGenerator<Result<never, unknown>, Result<T, unknown>>
): AsyncResult<T, unknown>;
function tryBlock<This>(
	thisArg: This,
	f: (this: This) => AsyncGenerator<Result<never, unknown>, void>
): AsyncResult<void, unknown>;
function tryBlock<This, T>(
	thisArg: This,
	f: (this: This) => Generator<Result<never, unknown>, Result<T, unknown>>
): Result<T, unknown>;
function tryBlock<This>(
	thisArg: This,
	f: (this: This) => Generator<Result<never, unknown>, void>
): Result<void, unknown>;

// Original overloads without this context
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

// Overloads without this context and optional onError (E defaults to unknown)
function tryBlock<T>(
	f: () => AsyncGenerator<Result<never, unknown>, Result<T, unknown>>
): AsyncResult<T, unknown>;
function tryBlock(
	f: () => AsyncGenerator<Result<never, unknown>, void>
): AsyncResult<void, unknown>;
function tryBlock<T>(
	f: () => Generator<Result<never, unknown>, Result<T, unknown>>
): Result<T, unknown>;
function tryBlock(f: () => Generator<Result<never, unknown>, void>): Result<void, unknown>;

// Implementation
function tryBlock<This, T, E>(
	thisArgOrF:
		| (() =>
				| AsyncGenerator<Result<never, E>, Result<T, E> | void>
				| Generator<Result<never, E>, Result<T, E> | void>)
		| This,
	fOrOnError?:
		| ((e: unknown) => E)
		| ((
				this: This
		  ) =>
				| AsyncGenerator<Result<never, E>, Result<T, E> | void>
				| Generator<Result<never, E>, Result<T, E> | void>),
	onError?: (e: unknown) => E
): AsyncResult<T | void, E> | Result<T | void, E> {
	let f: () =>
		| AsyncGenerator<Result<never, E>, Result<T, E> | void>
		| Generator<Result<never, E>, Result<T, E> | void>;
	let errorHandler: (e: unknown) => E;

	// Determine if first argument is thisArg or function
	if (typeof thisArgOrF !== 'function' && arguments.length >= 2) {
		const thisArg = thisArgOrF as This;
		f = fOrOnError!.bind(thisArg) as (
			this: This
		) =>
			| AsyncGenerator<Result<never, E>, Result<T, E> | void>
			| Generator<Result<never, E>, Result<T, E> | void>;
		errorHandler = onError ?? ((e: unknown) => e as E);
	} else {
		f = thisArgOrF as () =>
			| AsyncGenerator<Result<never, E>, Result<T, E> | void>
			| Generator<Result<never, E>, Result<T, E> | void>;
		errorHandler = (fOrOnError as ((e: unknown) => E) | undefined) ?? ((e: unknown) => e as E);
	}

	const generator = f();
	if (Symbol.asyncIterator in generator) {
		return AsyncResult.from(() => generator.next().then(({ value }) => value), errorHandler) as
			| AsyncResult<T, E>
			| AsyncResult<void, E>;
	} else {
		try {
			const { value } = generator.next();
			return value === undefined ? Result.Ok(undefined) : (value as Result<T, E>);
		} catch (e) {
			return Result.Err<T, E>(errorHandler(e));
		}
	}
}

export { tryBlock };
export * from './fetch';
export * from './json';
