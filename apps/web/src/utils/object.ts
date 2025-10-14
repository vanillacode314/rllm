type IsKeyOptional<T extends Record<PropertyKey, unknown>, Keys extends keyof T> =
	{ [Key in Keys]?: T[Key] } extends Pick<T, Keys> ? true : false;
type LastOf<T> =
	UnionToIntersection<T extends any ? () => T : never> extends () => infer R ? R : never;

type OptionalKeysOf<Obj> = keyof {
	[Key in keyof Obj as Omit<Obj, Key> extends Obj ? Key : never]: Obj[Key];
};

type PickOptionals<Obj> = Pick<Obj, OptionalKeysOf<Obj>>;

type Push<T extends any[], V> = [...T, V];
type TOptionalKeysToUndefined<T extends Record<PropertyKey, unknown>> = {
	[K in keyof T & {}]-?: true extends IsKeyOptional<T, K> ? T[K] | undefined : T[K];
};
type TuplifyUnion<T, L = LastOf<T>, N = [T] extends [never] ? true : false> =
	true extends N ? [] : Push<TuplifyUnion<Exclude<T, L>>, L>;
type UnionToIntersection<U> =
	(U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

function optionalKeysToUndefined<T extends Record<PropertyKey, unknown>>(
	object: T,
	optionalKeys: TuplifyUnion<OptionalKeysOf<T>>
): TOptionalKeysToUndefined<T> {
	const result = { ...object };
	for (const key of optionalKeys) {
		result[key as keyof T] ??= undefined as any;
	}
	return result as any;
}

export { optionalKeysToUndefined };
