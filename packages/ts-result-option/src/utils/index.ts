import { AsyncResult } from '~/async-result';
import { Result } from '~/result';

type AsyncGen<T, E> = AsyncGenerator<Result<never, E>, Result<T, E> | void>;
type SyncGen<T, E> = Generator<Result<never, E>, Result<T, E> | void>;

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
