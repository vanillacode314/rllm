import { Result } from './result';

interface Option<T> {
	and<U>(optb: Option<U>): Option<U>;
	andThen<U>(op: (value: T) => Option<U>): Option<U>;
	expect(msg: string): T;
	filter(predicate: (value: T) => boolean): Option<T>;
	flatten(): T extends Option<infer U> ? Option<U> : never;
	inspect(f: (value: T) => void): Option<T>;
	isNone(): boolean;
	isNoneOr<U extends T>(f: (value: T) => value is U): this is Option<U>;
	isNoneOr(f: (value: T) => boolean): boolean;
	isSome(): boolean;
	isSomeAnd<U extends T>(f: (value: T) => value is U): this is Option<U>;
	isSomeAnd(f: (value: T) => boolean): boolean;
	iter(): Iterator<T>;
	map<U>(op: (value: T) => U): Option<U>;
	mapOr<U>(_default: U, f: (value: T) => U): U;
	mapOrElse<U>(_default: () => U, f: (value: T) => U): U;
	match<U>(some: (value: T) => U, none: () => U): U;
	okOr<E>(err: E): Result<T, E>;
	okOrElse<E>(err: () => E): Result<T, E>;
	or(optb: Option<T>): Option<T>;
	orElse(op: () => Option<T>): Option<T>;
	toNull(): null | T;
	toUndefined(): T | undefined;
	transpose(): T extends Result<infer U, infer E> ? Result<Option<U>, E> : never;
	transposePromise(): T extends Promise<infer U> ? Promise<Option<U>> : never;
	unwrap(): T;
	unwrapOr(_default: T): T;
	unwrapOrElse(op: () => T): T;
	unzip(): T extends [infer A, infer B] ? [Option<A>, Option<B>] : never;
	xor(optb: Option<T>): Option<T>;
	zip<U>(other: Option<U>): Option<[T, U]>;
}

class None<T = never> implements Option<T> {
	constructor() {}
	and<U>(): Option<U> {
		return this as unknown as Option<U>;
	}
	andThen<U>(): Option<U> {
		return this as unknown as Option<U>;
	}
	expect(msg: string): T {
		throw new Error(msg);
	}
	filter(): Option<T> {
		return this;
	}
	flatten(): T extends Option<infer U> ? Option<U> : never {
		return this as unknown as T extends Option<infer U> ? Option<U> : never;
	}
	inspect(): Option<T> {
		return this;
	}
	isNone(): boolean {
		return true;
	}
	isNoneOr<U extends T>(): this is Option<U> {
		return true;
	}
	isSome(): boolean {
		return false;
	}
	isSomeAnd<U extends T>(): this is Option<U> {
		return false;
	}
	iter(): Iterator<T> {
		return {
			next(): IteratorResult<T> {
				return { done: true, value: undefined };
			}
		};
	}
	map<U>(): Option<U> {
		return this as unknown as Option<U>;
	}
	mapOr<U>(_default: U): U {
		return _default;
	}
	mapOrElse<U>(_default: () => U): U {
		return _default();
	}
	match<U>(_: unknown, none: () => U): U {
		return none();
	}
	okOr<E>(err: E): Result<T, E> {
		return Result.Err(err);
	}
	okOrElse<E>(err: () => E): Result<T, E> {
		return Result.Err(err());
	}
	or(optb: Option<T>): Option<T> {
		return optb;
	}
	orElse(op: () => Option<T>): Option<T> {
		return op();
	}
	toNull(): null | T {
		return null;
	}
	toUndefined(): T | undefined {
		return undefined;
	}
	transpose(): T extends Result<infer U, infer E> ? Result<Option<U>, E> : never {
		return Result.Ok(Option.None()) as T extends Result<infer U, infer E> ? Result<Option<U>, E>
		:	never;
	}
	transposePromise(): T extends Promise<infer U> ? Promise<Option<U>> : never {
		return Promise.resolve(Option.None()) as T extends Promise<infer U> ? Promise<Option<U>>
		:	never;
	}
	unwrap(): T {
		throw new Error('called `Option.unwrap()` on a `None` value');
	}
	unwrapOr(_default: T): T {
		return _default;
	}
	unwrapOrElse(op: () => T): T {
		return op();
	}
	unzip(): T extends [infer A, infer B] ? [Option<A>, Option<B>] : never {
		return [
			this as Option<T extends [infer A] ? A : never>,
			this as Option<T extends [unknown, infer B] ? B : never>
		] as T extends [infer A, infer B] ? [Option<A>, Option<B>] : never;
	}
	xor(optb: Option<T>): Option<T> {
		return optb.isSome() ? optb : this;
	}
	zip<U>(): Option<[T, U]> {
		return this as unknown as Option<[T, U]>;
	}
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-unused-vars
class Option<T> {
	static from<T>(value: null | T | undefined): Option<T> {
		return value === undefined || value === null ? Option.None() : Option.Some(value);
	}
	static fromNull<T>(value: null | T): Option<T> {
		return value === null ? Option.None() : Option.Some(value);
	}
	static fromUndefined<T>(value: T | undefined): Option<T> {
		return value === undefined ? Option.None() : Option.Some(value);
	}
	static isOption<T>(value: unknown): value is Option<T> {
		return value instanceof Some || value instanceof None;
	}
	static None<T>(): Option<T> {
		return new None();
	}
	static Some<T>(value: T): Option<T> {
		return new Some(value);
	}
}

class Some<T> implements Option<T> {
	constructor(private readonly value: T) {}
	and<U>(optb: Option<U>): Option<U> {
		return optb;
	}
	andThen<U>(op: (value: T) => Option<U>): Option<U> {
		return op(this.value);
	}
	expect(): T {
		return this.value;
	}
	filter(predicate: (value: T) => boolean): Option<T> {
		return predicate(this.value) ? this : Option.None();
	}
	flatten(): T extends Option<infer U> ? Option<U> : never {
		return this.value as T extends Option<infer U> ? Option<U> : never;
	}
	inspect(f: (value: T) => void): Option<T> {
		f(this.value);
		return this;
	}
	isNone(): boolean {
		return false;
	}
	isNoneOr<U extends T>(f: (value: T) => value is U): this is Option<U> {
		return f(this.value);
	}
	isSome(): boolean {
		return true;
	}
	isSomeAnd<U extends T>(f: (value: T) => value is U): this is Option<U> {
		return f(this.value);
	}
	iter(): Iterator<T> {
		return {
			next: () => ({ done: false, value: this.value })
		};
	}
	map<U>(op: (value: T) => U): Option<U> {
		return Option.Some(op(this.value));
	}
	mapOr<U>(_default: U, f: (value: T) => U): U {
		return f(this.value);
	}
	mapOrElse<U>(_default: () => U, f: (value: T) => U): U {
		return f(this.value);
	}
	match<U>(some: (value: T) => U, _: unknown): U {
		return some(this.value);
	}
	okOr<E>(): Result<T, E> {
		return Result.Ok(this.value);
	}
	okOrElse<E>(): Result<T, E> {
		return Result.Ok(this.value);
	}
	or(): Option<T> {
		return this;
	}
	orElse(): Option<T> {
		return this;
	}
	toNull(): null | T {
		return this.value;
	}
	toUndefined(): T | undefined {
		return this.value;
	}
	transpose(): T extends Result<infer U, infer E> ? Result<Option<U>, E> : never {
		return (this.value as Result<unknown, unknown>).map(Option.Some) as T extends (
			Result<infer U, infer E>
		) ?
			Result<Option<U>, E>
		:	never;
	}
	transposePromise(): T extends Promise<infer U> ? Promise<Option<U>> : never {
		return (this.value as Promise<unknown>).then(Option.Some) as T extends Promise<infer U> ?
			Promise<Option<U>>
		:	never;
	}
	unwrap(): T {
		return this.value;
	}
	unwrapOr(): T {
		return this.value;
	}
	unwrapOrElse(): T {
		return this.value;
	}
	unzip(): T extends [infer A, infer B] ? [Option<A>, Option<B>] : never {
		if (!(Array.isArray(this.value) && this.value.length !== 2)) {
			throw new Error(`Option.unzip() called on a non-tuple value: ${this.value}`);
		}

		return [
			Option.Some(this.value[0]) as Option<T extends [infer A] ? A : never>,
			Option.Some(this.value[1]) as Option<T extends [unknown, infer B] ? B : never>
		] as T extends [infer A, infer B] ? [Option<A>, Option<B>] : never;
	}
	xor(optb: Option<T>): Option<T> {
		return optb.isNone() ? this : optb;
	}
	zip<U>(other: Option<U>): Option<[T, U]> {
		if (other.isSome()) {
			return Option.Some([this.value, other.unwrap()]);
		}
		return Option.None();
	}
}

export { Option };
