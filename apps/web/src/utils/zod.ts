import { Option } from 'ts-result-option';
import * as z from 'zod/mini';

export function asOption<TSchema extends z.core.$ZodType>(schema: TSchema) {
  return z.pipe(
    z.optional(z.union([schema, z.null(), z.undefined()])),
    z.transform((value) => Option.from(value))
  );
}
