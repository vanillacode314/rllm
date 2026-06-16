type Resolve<T> = { [K in keyof T]: T[K] } & {};

export type { Resolve };
