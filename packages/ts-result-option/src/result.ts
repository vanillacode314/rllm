import type { Prettify, WithoutFn } from './types';

import { AsyncResult } from './async-result';
import { Option } from './option';

interface Result<T, E> {
	[Symbol.iterator](): Generator<Err<T, E>, T>;
	and<U>(res: Result<U, E>): Result<U, E>;
	andThen<U>(op: (value: T) => Result<U, E>): Result<U, E>;
	context(message: string): Result<T, Error>;
	err(): Option<E>;
	expect(msg: string): T;
	expectErr(msg: string): E;
	flatten(): T extends Result<infer U, E> ? Result<U, E> : never;
	inspect(f: (value: T) => void): Result<T, E>;
	inspectErr(f: (error: E) => void): Result<T, E>;
	isErr(): this is Result<never, E>;
	isErrAnd<F extends E>(f: (error: E) => error is F): this is Result<never, F>;
	isErrAnd(f: (error: E) => boolean): this is Result<never, E>;
	isOk(): this is Result<T, never>;
	isOkAnd<U extends T>(f: (value: T) => value is U): this is Result<U, never>;
	isOkAnd(f: (value: T) => boolean): this is Result<T, never>;
	map<U>(op: (value: T) => U): Result<U, E>;
	mapErr<F>(op: (error: E) => F): Result<T, F>;
	mapOr<U>(_default: U, f: (value: T) => U): U;
	mapOrElse<U>(_default: (error: E) => U, f: (value: T) => U): U;
	match<U>(ok: (value: T) => U, err: (error: E) => U): U;
	ok(): Option<T>;
	or<F>(res: Result<T, F>): Result<T, F>;
	orElse<F>(op: (error: E) => Result<T, F>): Result<T, F>;
	toAsync(): AsyncResult<T, E>;
	transpose(): T extends Option<infer U> ? Option<Result<U, E>> : never;
	unwrap(): T;
	unwrapErr(): E;
	unwrapOr(_default: T): T;
	unwrapOrElse(op: (error: E) => T): T;
	withContext(f: () => string): Result<T, Error>;
}

class Err<T, E> implements Result<T, E> {
	constructor(readonly error: E) {}
	and<U>(): Result<U, E> {
		return this as unknown as Result<U, E>;
	}
	andThen<U>(): Result<U, E> {
		return this as unknown as Result<U, E>;
	}
	context(message: string): Result<T, Error> {
		return new Err(new Error(message, { cause: this.error }));
	}
	err(): Option<E> {
		return Option.Some(this.error);
	}
	expect(msg: string): T {
		throw new Error(msg);
	}
	expectErr(): E {
		return this.error;
	}
	flatten(): T extends Result<infer U, E> ? Result<U, E> : never {
		return this as unknown as T extends Result<infer U, E> ? Result<U, E> : never;
	}
	inspect(): Result<T, E> {
		return this;
	}
	inspectErr(f: (error: E) => void): Result<T, E> {
		f(this.error);
		return this;
	}
	isErr(): this is Result<never, E> {
		return true;
	}
	isErrAnd<F extends E>(f: (error: E) => error is F): this is Result<never, F>;
	isErrAnd(f: (error: E) => boolean): this is Result<never, E> {
		return f(this.error);
	}
	isOk(): this is Result<T, never> {
		return false;
	}
	isOkAnd<U extends T>(f: (value: T) => value is U): this is Result<U, never>;
	isOkAnd(): this is Result<T, never> {
		return false;
	}
	map<U>(): Result<U, E> {
		return this as unknown as Result<U, E>;
	}
	mapErr<F>(op: (error: E) => F): Result<T, F> {
		return Result.Err(op(this.error));
	}
	mapOr<U>(_default: U): U {
		return _default;
	}
	mapOrElse<U>(_default: (error: E) => U): U {
		return _default(this.error);
	}
	match<U>(_: unknown, err: (error: E) => U): U {
		return err(this.error);
	}
	ok(): Option<T> {
		return Option.None();
	}
	or<F>(res: Result<T, F>): Result<T, F> {
		return res;
	}
	orElse<F>(op: (error: E) => Result<T, F>): Result<T, F> {
		return op(this.error);
	}
	*[Symbol.iterator](): Generator<Err<T, E>, T> {
		yield this;
		throw new Error('Unreachable');
	}
	toAsync(): AsyncResult<T, E> {
		return new AsyncResult(Promise.resolve(this));
	}
	transpose(): T extends Option<infer U> ? Option<Result<U, E>> : never {
		return Option.Some(this) as unknown as T extends Option<infer U> ? Option<Result<U, E>> : never;
	}
	unwrap(): T {
		throw new Error('called `Result.unwrap()` on an `Err` value', { cause: this.error });
	}
	unwrapErr(): E {
		return this.error;
	}
	unwrapOr(_default: T): T {
		return _default;
	}
	unwrapOrElse(op: (error: E) => T): T {
		return op(this.error);
	}
	withContext(f: () => string): Result<T, Error> {
		return new Err(new Error(f(), { cause: this.error }));
	}
}

class Ok<T, E> implements Result<T, E> {
	constructor(readonly value: T) {}
	and<U>(res: Result<U, E>): Result<U, E> {
		return res;
	}
	andThen<U>(op: (value: T) => Result<U, E>): Result<U, E> {
		return op(this.value);
	}
	context(): Result<T, Error> {
		return new Ok(this.value);
	}
	err(): Option<E> {
		return Option.None();
	}

	expect(): T {
		return this.value;
	}
	expectErr(msg: string): E {
		throw new Error(msg);
	}
	flatten(): T extends Result<infer U, E> ? Result<U, E> : never {
		if (!Result.isResult(this.value)) {
			throw new Error('called `Result.flatten()` on a non-Result value');
		}
		return this.value as T extends Result<infer U, E> ? Result<U, E> : never;
	}
	inspect(f: (value: T) => void): Result<T, E> {
		f(this.value);
		return this;
	}
	inspectErr(): Result<T, E> {
		return this;
	}
	isErr(): this is Result<never, E> {
		return false;
	}
	isErrAnd<F extends E>(f: (error: E) => error is F): this is Result<never, F>;
	isErrAnd(): this is Result<never, E> {
		return false;
	}
	isOk(): this is Result<T, never> {
		return true;
	}
	isOkAnd(f: (value: T) => boolean): this is Result<T, never>;
	isOkAnd<U extends T>(f: (value: T) => value is U): this is Result<U, never> {
		return f(this.value);
	}
	iter(): Iterator<T> {
		return {
			next: () => {
				return { done: true, value: this.value };
			}
		};
	}
	map<U>(op: (value: T) => U): Result<U, E> {
		return Result.Ok(op(this.value));
	}
	mapErr<F>(): Result<T, F> {
		return this as unknown as Result<T, F>;
	}
	mapOr<U>(_default: U, f: (value: T) => U): U {
		return f(this.value);
	}
	mapOrElse<U>(_default: (error: E) => U, f: (value: T) => U): U {
		return f(this.value);
	}
	match<U>(ok: (value: T) => U, _: unknown): U {
		return ok(this.value);
	}
	ok(): Option<T> {
		return Option.Some(this.value);
	}
	or<F>(): Result<T, F> {
		return this as unknown as Result<T, F>;
	}
	orElse<F>(): Result<T, F> {
		return this as unknown as Result<T, F>;
	}
	// eslint-disable-next-line require-yield
	*[Symbol.iterator](): Generator<Err<T, E>, T> {
		return this.value;
	}
	toAsync(): AsyncResult<T, E> {
		return new AsyncResult(Promise.resolve(this));
	}
	transpose(): T extends Option<infer U> ? Option<Result<U, E>> : never {
		if (!Option.isOption(this.value)) {
			throw new Error('called `Result.transpose()` on a non-Option value');
		}
		return this.value.map(Result.Ok) as never;
	}
	unwrap(): T {
		return this.value;
	}
	unwrapErr(): E {
		throw new Error('called `Result.unwrapErr()` on an `Ok` value');
	}
	unwrapOr(): T {
		return this.value;
	}
	unwrapOrElse(): T {
		return this.value;
	}
	withContext(): Result<T, Error> {
		return new Ok(this.value);
	}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-declaration-merging
class Result<T, E> {
	static Err<T = never, E = unknown>(error: E): Result<T, E> {
		return new Err(error);
	}
	static from<T, E>(f: () => T, onError: (e: unknown) => E): Result<T, E> {
		try {
			return Result.Ok(f());
		} catch (e) {
			return Result.Err(onError(e));
		}
	}
	static isResult<T, E>(value: unknown): value is Result<T, E> {
		return value instanceof Ok || value instanceof Err;
	}
	static Ok<T, E = never>(): Result<void, E>;
	static Ok<T, E = never>(value: T): Result<T, E>;
	static Ok<T, E = never>(value?: T): Result<T | void, E> {
		return new Ok(value);
	}
	static wrap<
		Fn extends (...args: any[]) => any,
		E,
		P extends WithoutFn<Fn> = Prettify<WithoutFn<Fn>>
	>(
		f: Fn,
		onError: (e: unknown, ...args: Parameters<Fn>) => E
	): ((...args: Parameters<Fn>) => Result<ReturnType<Fn>, E>) & P {
		const wrapped = (...args: Parameters<Fn>) =>
			Result.from(
				() => f(...args),
				(e) => onError(e, ...args)
			);
		return Object.assign(wrapped, f) as never;
	}
}

export { Err, Ok, Result };
