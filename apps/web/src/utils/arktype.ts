import { type Out, Type, type } from 'arktype'
import { Option } from 'ts-result-option'

const asOption = <const def, T = type.infer<def>>(
  t: type.validate<def>,
): Type<(In: null | T | undefined) => Out<Option<T>>> => {
  const T = type(t).or('undefined | null') as unknown as Type<
    null | T | undefined
  >
  return T.pipe((value) => Option.fromUndefinedOrNull(value))
}

const asOptionWithDefault = <const def, T = type.infer<def>>(
  t: type.validate<def>,
): [Type<(In: null | T | undefined) => Out<Option<T>>>, '=', null] => {
  return asOption(t).default(null as any) as never
}

export { asOption, asOptionWithDefault }
