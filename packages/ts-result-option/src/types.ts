type MaybePromise<T> = Promise<T> | T;
type Prettify<T> = T extends Function ? T : { [K in keyof T]: T[K] };
type WithoutFn<T> = Omit<T, keyof Function>;

export type { MaybePromise, Prettify, WithoutFn };
