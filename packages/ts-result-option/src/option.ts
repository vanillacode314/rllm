import { Result } from './result';

/**
 * A container that represents either a **Some** value or **None**.
 *
 * The API mirrors Rust's `Option<T>` and works with the {@link Result} type
 * shipped alongside this library.
 *
 * @typeParam T – The type of the inner value when the option is `Some`.
 *
 * @example
 * ```ts
 * const a = Option.Some(5);          // Some(5)
 * const b = Option.None<number>();   // None
 *
 * // Convert nullable values to an Option
 * const c = Option.from(null);       // None
 * const d = Option.from(10);         // Some(10)
 *
 * // Unwrap with a default
 * const value = a.unwrapOr(0); // 5
 * ```
 */
class Option<T> {
	/** @internal flag that tells if the option is `Some`. */
	private readonly _isSome: boolean;

	/** @internal the stored value – only valid when `_isSome` is `true`. */
	private readonly _value!: T;

	/**
	 * @private Use the static factories {@link Some} or {@link None}.
	 */
	private constructor(isSome: boolean, value?: T) {
		this._isSome = isSome;
		if (isSome) {
			// `value` is defined when `isSome` is true – the cast convinces TS.
			this._value = value as T;
		}
	}

	/**
	 * Create an `Option` from a nullable value (`null` | `undefined` | value).
	 *
	 * @param value – The value to wrap.
	 * @returns `None` if `value` is `null` or `undefined`, otherwise `Some(value)`.
	 */
	static from<T>(value: null | T | undefined): Option<T> {
		return value == null ? Option.None() : Option.Some(value);
	}

	/**
	 * Create an `Option` from a value that may be `null`.
	 *
	 * @param value – `null` | value.
	 */
	static fromNull<T>(value: null | T): Option<T> {
		return value === null ? Option.None() : Option.Some(value);
	}

	/**
	 * Create an `Option` from a value that may be `undefined`.
	 *
	 * @param value – `undefined` | value.
	 */
	static fromUndefined<T>(value: T | undefined): Option<T> {
		return value === undefined ? Option.None() : Option.Some(value);
	}

	/**
	 * Type‑guard that checks whether a value is an {@link Option}.
	 *
	 * @param value – Anything.
	 */
	static isOption<T>(value: unknown): value is Option<T> {
		return value instanceof Option;
	}

	/**
	 * Construct a `None` value.
	 *
	 * @typeParam T – The generic type that would be stored if this were `Some`.
	 */
	static None<T = never>(): Option<T> {
		return new Option<T>(false);
	}

	/**
	 * Construct a `Some` value.
	 *
	 * @param value – The inner value.
	 */
	static Some<T>(value: T): Option<T> {
		return new Option<T>(true, value);
	}

	/* --------------------------------------------------------------------- */
	/*                         Core combinators                              */
	/* --------------------------------------------------------------------- */

	/**
	 * Returns `optb` if the option is `Some`, otherwise returns `None`.
	 *
	 * @typeParam U – The inner type of the returned option.
	 * @param optb – The option to return if this is `Some`.
	 */
	and<U>(optb: Option<U>): Option<U> {
		return this._isSome ? optb : Option.None();
	}

	/**
	 * Calls `op` with the inner value if the option is `Some`, otherwise returns `None`.
	 *
	 * @typeParam U – The inner type of the returned option.
	 * @param op – Function that receives the inner value and returns an {@link Option}.
	 */
	andThen<U>(op: (value: T) => Option<U>): Option<U> {
		return this._isSome ? op(this._value) : Option.None();
	}

	/**
	 * Returns the contained value, throwing the provided message if the option is `None`.
	 *
	 * @param msg – The error message.
	 * @throws {Error} if the option is `None`.
	 */
	expect(msg: string): T {
		if (!this._isSome) {
			throw new Error(msg);
		}
		return this._value;
	}

	/**
	 * Returns `None` if the predicate returns `false`, otherwise returns `this`.
	 *
	 * @param predicate – Function that decides whether the value should be kept.
	 */
	filter(predicate: (value: T) => boolean): Option<T> {
		return this._isSome && predicate(this._value) ? this : Option.None();
	}

	/**
	 * Flattens an `Option` of an `Option` into a single `Option`.
	 *
	 * @remarks
	 *   The method is only callable when `T` itself is an `Option<U>`.
	 */
	flatten(): T extends Option<infer U> ? Option<U> : Option<T> {
		if (!this._isSome) {
			return Option.None() as never;
		}
		return (Option.isOption(this._value) ? this._value : this) as never;
	}

	/**
	 * Calls `f` with the inner value for side‑effects and returns `this`.
	 *
	 * @param f – Function executed only when the option is `Some`.
	 */
	inspect(f: (value: T) => void): Option<T> {
		if (this._isSome) {
			f(this._value);
		}
		return this;
	}

	/**
	 * Returns `true` if the option is `None`.
	 */
	isNone(): boolean {
		return !this._isSome;
	}

	/**
	 * Returns `true` if the option is `None` **or** the predicate returns `true`.
	 *
	 * @typeParam U – Narrowed type of the inner value.
	 * @param f – Type‑guard or boolean predicate.
	 */
	isNoneOr<U extends T>(f: (value: T) => value is U): this is Option<U>;
	isNoneOr(f: (value: T) => boolean): boolean;
	isNoneOr(f: (value: T) => boolean): boolean {
		return !this._isSome || f(this._value);
	}

	/**
	 * Returns `true` if the option is `Some`.
	 */
	isSome(): boolean {
		return this._isSome;
	}

	/**
	 * Returns `true` if the option is `Some` **and** the predicate returns `true`.
	 *
	 * @typeParam U – Narrowed type of the inner value.
	 * @param f – Type‑guard or boolean predicate.
	 */
	isSomeAnd<U extends T>(f: (value: T) => value is U): this is Option<U>;
	isSomeAnd(f: (value: T) => boolean): boolean;
	isSomeAnd(f: (value: T) => boolean): boolean {
		return this._isSome && f(this._value);
	}

	/**
	 * Returns an iterator that yields the inner value once (if `Some`) or yields nothing (if `None`).
	 */
	*iter(): IterableIterator<T> {
		if (this._isSome) {
			yield this._value;
		}
	}

	/**
	 * Maps an `Option<T>` to `Option<U>` by applying `op` to a contained value.
	 *
	 * @typeParam U – The result type.
	 * @param op – Mapping function.
	 */
	map<U>(op: (value: T) => U): Option<U> {
		return this._isSome ? Option.Some(op(this._value)) : Option.None();
	}

	/**
	 * Returns the result of applying `f` to the contained value, or returns `_default` if `None`.
	 *
	 * @typeParam U – The result type.
	 */
	mapOr<U>(_default: U, f: (value: T) => U): U {
		return this._isSome ? f(this._value) : _default;
	}

	/**
	 * Computes a default function (`_default`) lazily, then applies `f` to the contained value.
	 *
	 * @typeParam U – The result type.
	 */
	mapOrElse<U>(_default: () => U, f: (value: T) => U): U {
		return this._isSome ? f(this._value) : _default();
	}

	/**
	 * Pattern‑matches the option.
	 *
	 * @typeParam U – The return type of both branches.
	 * @param some – Called with the inner value when `Some`.
	 * @param none – Called when `None`.
	 */
	match<U>(some: (value: T) => U, none: () => U): U {
		return this._isSome ? some(this._value) : none();
	}

	/**
	 * Transforms the `Option<T>` into a {@link Result<T,E>} that is `Ok(value)` when `Some`,
	 * otherwise `Err(err)`.
	 *
	 * @typeParam E – The error type of the resulting `Result`.
	 * @param err – The error value used when the option is `None`.
	 */
	okOr<E>(err: E): Result<T, E> {
		return this._isSome ? Result.Ok(this._value) : Result.Err(err);
	}

	/**
	 * Like {@link okOr} but the error value is produced lazily.
	 *
	 * @typeParam E – The error type of the resulting `Result`.
	 * @param err – Function that creates the error when the option is `None`.
	 */
	okOrElse<E>(err: () => E): Result<T, E> {
		return this._isSome ? Result.Ok(this._value) : Result.Err(err());
	}

	/**
	 * Returns `this` if it is `Some`, otherwise returns `optb`.
	 *
	 * @param optb – Fallback option.
	 */
	or(optb: Option<T>): Option<T> {
		return this._isSome ? this : optb;
	}

	/**
	 * Returns `this` if it is `Some`, otherwise calls `op` and returns its result.
	 *
	 * @param op – Lazy fallback factory.
	 */
	orElse(op: () => Option<T>): Option<T> {
		return this._isSome ? this : op();
	}

	/**
	 * Converts the option into `null | T`. `None` becomes `null`.
	 */
	toNull(): null | T {
		return this._isSome ? this._value : null;
	}

	/**
	 * Converts the option into `T | undefined`. `None` becomes `undefined`.
	 */
	toUndefined(): T | undefined {
		return this._isSome ? this._value : undefined;
	}

	/**
	 * Transposes an `Option<Result<U,E>>` into a `Result<Option<U>,E>`.
	 *
	 * @remarks
	 *   The method is only callable when `T` extends `Result<U,E>`.
	 */
	transpose(): T extends Result<infer U, infer E> ? Result<Option<U>, E> : never {
		if (!this._isSome) {
			return Result.Ok(Option.None()) as never;
		}
		if (!Result.isResult(this._value))
			throw new Error(`Option.transpose() called on a non-Result value`);
		return this._value.map(Option.Some) as never;
	}

	/**
	 * Transposes an `Option<Promise<U>>` into a `Promise<Option<U>>`.
	 *
	 * @remarks
	 *   The method is only callable when `T` extends `Promise<U>`.
	 */
	transposePromise(): T extends Promise<infer U> ? Promise<Option<U>> : never {
		if (!this._isSome) {
			return Promise.resolve(Option.None()) as never;
		}
		if (!(this._value instanceof Promise)) {
			throw new Error(`Option.transposePromise() called on a non-Promise value`);
		}
		return this._value.then(Option.Some) as never;
	}

	/**
	 * Returns the contained value. Throws if the option is `None`.
	 *
	 * @throws {Error} when called on `None`.
	 */
	unwrap(): T {
		if (!this._isSome) {
			throw new Error('called `Option.unwrap()` on a `None` value');
		}
		return this._value;
	}

	/**
	 * Returns the contained value or a provided default.
	 *
	 * @param _default – Fallback value used when `None`.
	 */
	unwrapOr(_default: T): T {
		return this._isSome ? this._value : _default;
	}

	/**
	 * Returns the contained value or computes it lazily from a closure.
	 *
	 * @param op – Function that produces a fallback value.
	 */
	unwrapOrElse(op: () => T): T {
		return this._isSome ? this._value : op();
	}

	/**
	 * If the option holds a tuple `[A, B]`, returns a pair of options `[Option<A>, Option<B>]`.
	 *
	 * @remarks
	 *   The method is only callable when `T` extends `[A, B]`.
	 */
	unzip(): T extends [infer A, infer B] ? [Option<A>, Option<B>] : never {
		if (!this._isSome) {
			return [Option.None(), Option.None()] as never;
		}
		const tuple = this._value;
		if (!Array.isArray(tuple) || tuple.length !== 2) {
			throw new Error(`Option.unzip() called on a non‑tuple value`);
		}
		const [a, b] = tuple;
		return [Option.Some(a), Option.Some(b)] as never;
	}

	/**
	 * Returns `Some` if exactly one of `this` and `optb` is `Some`.
	 *
	 * @param optb – The other option to compare with.
	 */
	xor(optb: Option<T>): Option<T> {
		return (
			this._isSome !== optb._isSome ?
				this._isSome ?
					this
				:	optb
			:	Option.None()
		);
	}

	/**
	 * Returns `Some([a, b])` if **both** options are `Some`, otherwise `None`.
	 *
	 * @typeParam U – The inner type of the other option.
	 * @param other – The option to zip with.
	 */
	zip<U>(other: Option<U>): Option<[T, U]> {
		if (this._isSome && other._isSome) {
			return Option.Some([this._value, other._value] as [T, U]);
		}
		return Option.None();
	}
}

/* --------------------------------------------------------------------- */
/*                               Re‑exports                               */
/* --------------------------------------------------------------------- */

export { Option };
