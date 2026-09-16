import { AsyncResult } from '~/async-result';
import { Result } from '~/result';

/** Shape a `tryBlock` generator must have. Annotate the generator with it
 *  (`async function* (): AsyncGen<T, E> { … }`) to have TypeScript check every
 *  `return`/`yield` inside the block against `T`/`E`, so a wrong payload is
 *  reported on the offending `return` instead of on the `tryBlock` call. */
export type AsyncGen<T, E> = AsyncGenerator<Result<never, E>, Result<T, E> | void>;
/** Sync counterpart of {@link AsyncGen} — use with a `function*` block. */
export type SyncGen<T, E> = Generator<Result<never, E>, Result<T, E> | void>;

/** Drop the `void`/nullish members of a generator return type (`Result<T, E> | void`)
 *  so the `Result` branch can be inspected. */
type PayloadSource<R> = R extends void ? never : NonNullable<R>;
/** Payload of a `Result`'s Ok channel, `unknown` when the argument is not a `Result`. */
type OkPayload<R> = PayloadSource<R> extends Result<infer T, unknown> ? T : unknown;
/** Error channel of a `Result`, `never` when the argument is not a `Result`. */
type ErrPayload<R> = PayloadSource<R> extends Result<unknown, infer E> ? E : never;
/** Result type of a `tryBlock` call, derived from the generator that was passed
 *  (mirrors neverthrow's `InferOkTypes`/`InferErrTypes`). */
type YieldErrPayload<Y> = Y extends Result<never, infer YE> ? YE : never;
type GenResult<F, E> = F extends () => AsyncGenerator<infer Y, infer R, unknown>
  ? AsyncResult<OkPayload<R>, ErrPayload<R> | YieldErrPayload<Y> | E>
  : F extends () => Generator<infer Y, infer R, unknown>
    ? Result<OkPayload<R>, ErrPayload<R> | YieldErrPayload<Y> | E>
    : never;

export function tryBlock<T, E>(
  f: () => AsyncGen<T, E>,
  onError: (e: unknown) => E
): AsyncResult<T, E>;
export function tryBlock<T>(f: () => AsyncGen<T, unknown>): AsyncResult<T, unknown>;
export function tryBlock<T, E>(f: () => SyncGen<T, E>, onError: (e: unknown) => E): Result<T, E>;
export function tryBlock<T>(f: () => SyncGen<T, unknown>): Result<T, unknown>;
export function tryBlock<This, T, E>(
  thisArg: This,
  f: (this: This) => AsyncGen<T, E>,
  onError: (e: unknown) => E
): AsyncResult<T, E>;
export function tryBlock<This, T>(
  thisArg: This,
  f: (this: This) => AsyncGen<T, unknown>
): AsyncResult<T, unknown>;
export function tryBlock<This, T, E>(
  thisArg: This,
  f: (this: This) => SyncGen<T, E>,
  onError: (e: unknown) => E
): Result<T, E>;
export function tryBlock<This, T>(
  thisArg: This,
  f: (this: This) => SyncGen<T, unknown>
): Result<T, unknown>;

/** Recovery overload — keep LAST.
 *  Every signature above is strict: a generator whose payload does not line up is
 *  rejected, and "no overload matches this call" is reported here. This one instead
 *  accepts any `tryBlock`-shaped generator and derives its result type from that
 *  generator, so a mismatched payload becomes an ordinary assignability error where
 *  the value is used (e.g. the enclosing `return`) instead of an overload failure.
 *  For the mistake itself to be flagged, annotate the generator block with
 *  {@link AsyncGen} / {@link SyncGen} — then each `return`/`yield` is checked against
 *  `T`/`E` and the offending one is reported directly. */
export function tryBlock<
  F extends
    | (() => AsyncGenerator<Result<never, unknown>, unknown, unknown>)
    | (() => Generator<Result<never, unknown>, unknown, unknown>),
  E
>(f: F, onError?: (e: unknown) => E): GenResult<F, E>;
export function tryBlock<This, T, E>(
  arg1: (() => AsyncGen<T, E> | SyncGen<T, E>) | This,
  arg2?: ((e: unknown) => E) | ((this: This) => AsyncGen<T, E> | SyncGen<T, E>),
  arg3?: (e: unknown) => E
): AsyncResult<T, E> | Result<T, E> {
  let f: () => AsyncGen<T, E> | SyncGen<T, E>;
  let errorHandler: (e: unknown) => E = (e: unknown) => e as E;

  if (typeof arg1 !== 'function') {
    const thisArg = arg1 as This;
    const targetFn = arg2 as (this: This) => AsyncGen<T, E> | SyncGen<T, E>;
    f = () => targetFn.call(thisArg);
    if (arg3) errorHandler = arg3;
  } else {
    f = arg1 as () => AsyncGen<T, E> | SyncGen<T, E>;
    if (typeof arg2 === 'function') {
      errorHandler = arg2 as (e: unknown) => E;
    }
  }

  const iter = f();

  if (Symbol.asyncIterator in iter) {
    return AsyncResult.from(async () => {
      const result = await iter.next();
      return result.value ?? Result.Ok(undefined as T);
    }, errorHandler) as AsyncResult<T, E>;
  }

  try {
    const { value } = iter.next();
    // If value is a Result, return it; if void (undefined), wrap in Ok
    return (value ?? Result.Ok(undefined)) as Result<T, E>;
  } catch (e) {
    return Result.Err(errorHandler(e));
  }
}

export * from './fetch';
export * from './json';
