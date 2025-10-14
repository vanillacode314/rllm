// ──────────────────────────────────────────────────────────────
//  types.ts – unchanged (you still import Prettify, WithoutFn)
// ──────────────────────────────────────────────────────────────
import type { Prettify, WithoutFn } from './types';

import { AsyncResult } from './async-result';
import { Option } from './option';

/**
 * The single implementation of Result.
 *
 * @template T – the type of a successful value
 * @template E – the type of an error value
 */
class Result<T, E> {
	private readonly _error?: E; // present only when _tag === 'Err'
	// -----------------------------------------------------------------
	//  Internal representation
	// -----------------------------------------------------------------
	private readonly _tag: 'Err' | 'Ok';
	private readonly _value?: T; // present only when _tag === 'Ok'

	/** @private – callers must use the static factories */
	private constructor(tag: 'Err' | 'Ok', payload: E | T) {
		this._tag = tag;
		if (tag === 'Ok') {
			this._value = payload as T;
		} else {
			this._error = payload as E;
		}
		// freeze makes the instance effectively immutable (optional)
		Object.freeze(this);
	}

	static Err<T = never, E = unknown>(error: E): Result<T, E> {
		return new Result<T, E>('Err', error);
	}
	static from<T, E>(fn: () => T, onError: (e: unknown) => E): Result<T, E> {
		try {
			return Result.Ok(fn());
		} catch (e) {
			return Result.Err(onError(e));
		}
	}
	static isResult<T, E>(v: unknown): v is Result<T, E> {
		return v instanceof Result;
	}
	// -----------------------------------------------------------------
	//  Static factories
	// -----------------------------------------------------------------
	static Ok<E = never>(): Result<void, E>;
	static Ok<T, E = never>(value: T): Result<T, E>;
	static Ok<T, E = never>(value?: T): Result<T | void, E> {
		// `void` is used when no argument is supplied – mirrors the old overload
		return new Result('Ok', value as never);
	}

	static wrap<
		Fn extends (...args: any[]) => any,
		E,
		P extends WithoutFn<Fn> = Prettify<WithoutFn<Fn>>
	>(fn: Fn, onError: (e: unknown, ...args: Parameters<Fn>) => E) {
		const wrapped = (...args: Parameters<Fn>) =>
			Result.from(
				() => fn(...args),
				(e) => onError(e, ...args)
			);
		// Preserve the original function's properties (name, length, etc.)
		return Object.assign(wrapped, fn) as unknown as ((
			...args: Parameters<Fn>
		) => Result<ReturnType<Fn>, E>) &
			P;
	}
	// -----------------------------------------------------------------
	//  Transformations
	// -----------------------------------------------------------------
	and<U>(res: Result<U, E>): Result<U, E> {
		return this._tag === 'Ok' ? res : (this as unknown as Result<U, E>);
	}
	andThen<U>(op: (v: T) => Result<U, E>): Result<U, E> {
		return this._tag === 'Ok' ? op(this._value as T) : (this as unknown as Result<U, E>);
	}
	/** Attach a new `Error` cause while preserving the original payload. */
	context(message: string): Result<T, Error> {
		if (this._tag === 'Ok') return Result.Ok(this._value as T);
		return Result.Err(new Error(message, { cause: this._error }));
	}
	// -----------------------------------------------------------------
	//  Core accessors
	// -----------------------------------------------------------------
	/** Returns `Some(error)` if this is an Err, otherwise `None`. */
	err(): Option<E> {
		return this._tag === 'Err' ? Option.Some(this._error as E) : Option.None();
	}
	/** Panics with a custom message if the result is Err. */
	expect(msg: string): T {
		if (this._tag === 'Ok') return this._value as T;
		throw new Error(msg, { cause: this._error });
	}
	/** Panics with a custom message if the result is Ok. */
	expectErr(msg: string): E {
		if (this._tag === 'Err') return this._error as E;
		throw new Error(msg, { cause: this._value });
	}

	/** If the Ok contains another Result, flatten it (Result<Result<…>> → Result<…>). */
	flatten(): T extends Result<infer U, E> ? Result<U, E> : never {
		if (this._tag === 'Ok') {
			const inner = this._value as unknown;
			if (!Result.isResult(inner)) {
				throw new Error('called `Result.flatten()` on a non‑Result value', {
					cause: inner
				});
			}
			return inner as never;
		}
		return this as unknown as never;
	}
	/** Calls a side‑effect function with the value and returns the original result. */
	inspect(f: (v: T) => void): this {
		if (this._tag === 'Ok') f(this._value as T);
		return this;
	}

	/** Calls a side‑effect function with the error and returns the original result. */
	inspectErr(f: (e: E) => void): this {
		if (this._tag === 'Err') f(this._error as E);
		return this;
	}
	isErr(): this is Result<never, E> {
		return this._tag === 'Err';
	}
	isErrAnd<F extends E>(pred: (e: E) => e is F): this is Result<never, F>;
	isErrAnd(pred: (e: E) => boolean) {
		return this._tag === 'Err' && pred(this._error as E);
	}
	// -----------------------------------------------------------------
	//  Type‑guards (the public API you already use)
	// -----------------------------------------------------------------
	isOk(): this is Result<T, never> {
		return this._tag === 'Ok';
	}
	isOkAnd<U extends T>(pred: (v: T) => v is U): this is Result<U, never>;
	isOkAnd(pred: (v: T) => boolean): this is Result<T, never>;
	isOkAnd(pred: (v: T) => boolean) {
		return this._tag === 'Ok' && pred(this._value as T);
	}
	map<U>(op: (v: T) => U): Result<U, E> {
		return this._tag === 'Ok' ? Result.Ok(op(this._value as T)) : (this as unknown as Result<U, E>);
	}
	mapErr<F>(op: (e: E) => F): Result<T, F> {
		return this._tag === 'Err' ?
				Result.Err(op(this._error as E))
			:	(this as unknown as Result<T, F>);
	}
	/** If the result is Ok, returns `op(value)`, otherwise returns the supplied default. */
	mapOr<U>(def: U, op: (v: T) => U): U {
		return this._tag === 'Ok' ? op(this._value as T) : def;
	}
	/** If the result is Ok, returns `op(value)`, otherwise returns `def(error)`. */
	mapOrElse<U>(def: (e: E) => U, op: (v: T) => U): U {
		return this._tag === 'Ok' ? op(this._value as T) : def(this._error as E);
	}
	/** Calls `ok(v)` if this is Ok, otherwise `err(e)`. */
	match<U>(ok: (v: T) => U, err: (e: E) => U): U {
		return this._tag === 'Ok' ? ok(this._value as T) : err(this._error as E);
	}
	/** Returns `Some(value)` if this is an Ok, otherwise `None`. */
	ok(): Option<T> {
		return this._tag === 'Ok' ? Option.Some(this._value as T) : Option.None();
	}
	or<F>(res: Result<T, F>): Result<T, F> {
		return this._tag === 'Err' ? res : (this as unknown as Result<T, F>);
	}
	orElse<F>(op: (e: E) => Result<T, F>): Result<T, F> {
		return this._tag === 'Err' ? op(this._error as E) : (this as unknown as Result<T, F>);
	}
	// -----------------------------------------------------------------
	//  Iterator support (mirrors the original design)
	// -----------------------------------------------------------------
	/** Yield the Err (if any) and then throw – mimics the old `Err` iterator. */
	*[Symbol.iterator](): Generator<Result<never, E>, T> {
		if (this._tag === 'Err') {
			// `yield` the current instance (treated as an Err)
			yield this as unknown as Result<never, E>;
			// the generator should never reach a normal return – keep the old behaviour
			throw new Error('Unreachable');
		}
		// For an Ok we simply return the inner value (no yielded Err)
		return this._value as T;
	}
	/** Turns the result into an `AsyncResult`. */
	toAsync(): AsyncResult<T, E> {
		return new AsyncResult(Promise.resolve(this));
	}
	/** Turns `Result<T, E>` where `T` is an `Option<U>` into `Option<Result<U, E>>`. */
	transpose(): T extends Option<infer U> ? Option<Result<U, E>> : never {
		if (this._tag === 'Ok') {
			const opt = this._value as unknown;
			if (!Option.isOption(opt)) {
				throw new Error('called `Result.transpose()` on a non‑Option value', {
					cause: opt
				});
			}
			// map the Some case to Ok, keep None as None
			return opt.map((v) => Result.Ok(v)) as never;
		}
		// Err propagates unchanged, wrapped in Some
		return Option.Some(this) as never;
	}
	/** Unwraps the value, throwing if it is an Err. */
	unwrap(): T {
		if (this._tag === 'Ok') return this._value as T;
		throw new Error('called `Result.unwrap()` on an `Err` value', {
			cause: this._error
		});
	}
	/** Unwraps the error, throwing if it is an Ok. */
	unwrapErr(): E {
		if (this._tag === 'Err') return this._error as E;
		throw new Error('called `Result.unwrapErr()` on an `Ok` value', {
			cause: this._value
		});
	}
	/** Returns the contained value or a default. */
	unwrapOr(defaultValue: T): T {
		return this._tag === 'Ok' ? (this._value as T) : defaultValue;
	}

	/** Returns the contained value or the result of `op(error)`. */
	unwrapOrElse(op: (e: E) => T): T {
		return this._tag === 'Ok' ? (this._value as T) : op(this._error as E);
	}

	/** Same as `context` but the message is generated lazily. */
	withContext(f: () => string): Result<T, Error> {
		if (this._tag === 'Ok') return Result.Ok(this._value as T);
		return Result.Err(new Error(f(), { cause: this._error }));
	}
}

const Err = Result.Err;
const Ok = Result.Ok;

export { Err, Ok, Result };
