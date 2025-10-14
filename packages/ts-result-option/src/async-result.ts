import type { MaybePromise, Prettify, WithoutFn } from './types';

import { Option } from './option';
import { Result } from './result';

type MaybeAsyncResult<T, E> = AsyncResult<T, E> | Result<T, E>;

class AsyncResult<T, E> {
	get finally() {
		return this.resultPromise.finally.bind(this.resultPromise);
	}
	/** expose the underlying Promise so callers can `await` or chain */
	get then() {
		return this.resultPromise.then.bind(this.resultPromise);
	}

	constructor(private readonly resultPromise: Promise<Result<T, E>>) {}

	static Err<T = never, E = unknown>(error: E): AsyncResult<T, E> {
		return new AsyncResult(Promise.resolve(Result.Err(error)));
	}
	/** `from` is overloaded so you can feed it a Promise<Result> **or**
	 * a Promise<T>. The `onError` handler can be sync or async. */
	static from<T, E>(
		promise: () => Promise<Result<T, E>>,
		onError: (error: unknown) => MaybePromise<E>
	): AsyncResult<T, E>;
	static from<T, E>(
		promise: () => Promise<T>,
		onError: (error: unknown) => MaybePromise<E>
	): AsyncResult<T, E>;
	static from<T, E>(
		promise: () => Promise<Result<T, E> | T>,
		onError: (error: unknown) => MaybePromise<E>
	): AsyncResult<T, E> {
		const p = Promise.try(promise).then(
			(v) => (Result.isResult(v) ? v : Result.Ok(v)),
			async (e) => Result.Err(await onError(e))
		);
		return new AsyncResult(p);
	}

	/* -------------------------- static factories -------------------------- */
	static Ok<E = never>(): AsyncResult<void, E>;
	static Ok<T, E = never>(value: T): AsyncResult<T, E>;
	static Ok<T, E = never>(value?: T): AsyncResult<T | void, E> {
		return new AsyncResult(Promise.resolve(Result.Ok(value)));
	}

	/** Wrap an async function so it returns an AsyncResult instead of throwing. */
	static wrap<
		Fn extends (...args: any[]) => Promise<any>,
		E,
		P extends WithoutFn<Fn> = Prettify<WithoutFn<Fn>>
	>(
		fn: Fn,
		onError: (e: unknown, ...args: Parameters<Fn>) => E
	): ((...args: Parameters<Fn>) => AsyncResult<Awaited<ReturnType<Fn>>, E>) & P {
		const wrapped = (...args: Parameters<Fn>) =>
			AsyncResult.from(
				() => fn(...args),
				(e) => onError(e, ...args)
			);
		return Object.assign(wrapped, fn) as never;
	}

	/* ---------------------------- combinators ---------------------------- */
	and<U>(res: MaybeAsyncResult<U, E>): AsyncResult<U, E> {
		return new AsyncResult(
			this.match(
				() => (Result.isResult(res) ? res : res.resultPromise),
				() => this.resultPromise as unknown as Promise<Result<U, E>>
			)
		);
	}
	andThen<U>(op: (value: T) => MaybeAsyncResult<U, E>): AsyncResult<U, E> {
		return new AsyncResult(
			this.match(
				async (value) => {
					const r = op(value);
					return Result.isResult(r) ? r : r.resultPromise;
				},
				() => this.resultPromise as unknown as Promise<Result<U, E>>
			)
		);
	}
	context(message: string): AsyncResult<T, Error> {
		return this.mapErr((e) => new Error(message, { cause: e }));
	}
	/* -------------------------- inspection -------------------------- */
	err(): Promise<Option<E>> {
		return this.resultPromise.then((r) => r.err());
	}
	expect(msg: string): Promise<T> {
		return this.resultPromise.then((r) => r.expect(msg));
	}
	expectErr(msg: string): Promise<E> {
		return this.resultPromise.then((r) => r.expectErr(msg));
	}
	flatten(): T extends MaybeAsyncResult<infer U, E> ? AsyncResult<U, E> : never {
		return new AsyncResult(
			this.match(
				async (value) => {
					const inner = value as MaybeAsyncResult<unknown, E>;
					return Result.isResult(inner) ? inner : inner.resultPromise;
				},
				() => this.resultPromise
			)
		) as never;
	}

	inspect(f: (value: T) => void): AsyncResult<T, E> {
		return new AsyncResult(this.resultPromise.then((r) => r.inspect(f)));
	}
	inspectErr(f: (error: E) => void): AsyncResult<T, E> {
		return new AsyncResult(this.resultPromise.then((r) => r.inspectErr(f)));
	}
	isErr(): Promise<boolean> {
		return this.resultPromise.then((r) => r.isErr());
	}
	isErrAnd(f: (error: E) => MaybePromise<boolean>): Promise<boolean> {
		return this.match(
			() => false,
			(e) => f(e)
		);
	}
	isOk(): Promise<boolean> {
		return this.resultPromise.then((r) => r.isOk());
	}
	isOkAnd(f: (value: T) => MaybePromise<boolean>): Promise<boolean> {
		return this.match(
			(v) => f(v),
			() => false
		);
	}
	map<U>(op: (value: T) => MaybePromise<U>): AsyncResult<U, E> {
		return new AsyncResult(
			this.resultPromise.then(async (r) =>
				r.isOk() ? Result.Ok(await Promise.resolve(op(r.unwrap()))) : (r as unknown as Result<U, E>)
			)
		);
	}
	mapErr<F>(op: (error: E) => MaybePromise<F>): AsyncResult<T, F> {
		return new AsyncResult(
			this.resultPromise.then(async (r) =>
				r.isErr() ?
					Result.Err(await Promise.resolve(op(r.unwrapErr())))
				:	(r as unknown as Result<T, F>)
			)
		);
	}
	mapOr<U>(_default: U, f: (value: T) => MaybePromise<U>): Promise<U> {
		return this.match(f, () => _default);
	}
	mapOrElse<U>(
		_default: (error: E) => MaybePromise<U>,
		f: (value: T) => MaybePromise<U>
	): Promise<U> {
		return this.match(f, _default);
	}
	match<U>(ok: (value: T) => MaybePromise<U>, err: (error: E) => MaybePromise<U>): Promise<U> {
		return this.resultPromise.then((r) => r.match(ok, err));
	}
	ok(): Promise<Option<T>> {
		return this.resultPromise.then((r) => r.ok());
	}
	or<F>(res: MaybeAsyncResult<T, F>): AsyncResult<T, F> {
		return new AsyncResult(
			this.resultPromise.then((r) =>
				r.isOk() ? (r as unknown as Result<T, F>)
				: Result.isResult(res) ? res
				: res.resultPromise
			)
		);
	}
	orElse<F>(op: (error: E) => MaybeAsyncResult<T, F>): AsyncResult<T, F> {
		return new AsyncResult(
			this.resultPromise.then(async (r) => {
				if (r.isOk()) return r as unknown as Result<T, F>;
				const inner = op(r.unwrapErr());
				return Result.isResult(inner) ? inner : inner.resultPromise;
			})
		);
	}
	async *[Symbol.asyncIterator](): AsyncGenerator<Result<never, E>, T> {
		const result = await this.resultPromise;
		return yield* result;
	}
	transpose(): Promise<T extends Option<infer U> ? Option<Result<U, E>> : never> {
		return this.resultPromise.then((r) => r.transpose());
	}
	unwrap(): Promise<T> {
		return this.resultPromise.then((r) => r.unwrap());
	}
	unwrapErr(): Promise<E> {
		return this.resultPromise.then((r) => r.unwrapErr());
	}
	unwrapOr(_default: T): Promise<T> {
		return this.resultPromise.then((r) => r.unwrapOr(_default));
	}
	unwrapOrElse(op: (error: E) => MaybePromise<T>): Promise<T> {
		return this.resultPromise.then((r) => (r.isOk() ? r.unwrap() : op(r.unwrapErr())));
	}

	withContext(f: () => MaybePromise<string>): AsyncResult<T, Error> {
		return this.mapErr(async (e) => new Error(await f(), { cause: e }));
	}
}

export { AsyncResult };
