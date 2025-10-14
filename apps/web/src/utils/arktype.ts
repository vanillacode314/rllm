import { type Out, Type, type } from 'arktype';
import { Option } from 'ts-result-option';

import type { JsonTree } from './tree';

const asOption = <const def, T = type.infer<def>>(
	t: type.validate<def>
): Type<(In: null | T | undefined) => Out<Option<T>>> => {
	const T = type(t).or('undefined | null') as unknown as Type<null | T | undefined>;
	return T.pipe((value) => Option.from(value));
};

const asOptionWithDefault = <const def, T = type.infer<def>>(
	t: type.validate<def>
): [Type<(In: null | T | undefined) => Out<Option<T>>>, '=', null] => {
	return asOption(t).default(null as any) as never;
};

// WARN: Doesn't work for some reason
function JsonTreeSchema<const def>(of: type.validate<def>): Type<JsonTree<type.infer<def>>> {
	return type.raw({ value: type('null').or(of), children: type('unknown').array() }) as never;
}

export { asOption, asOptionWithDefault, JsonTreeSchema };
