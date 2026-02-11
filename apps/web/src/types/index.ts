import * as z from 'zod/mini';

const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('openai'),
  baseUrl: z.url(),
  token: z.string(),
  defaultModelIds: z.array(z.string())
});
type TProvider = z.infer<typeof providerSchema>;

const toolSchema = z.object({
  name: z.string(),
  description: z.string(),
  // TODO: figure out z.any()
  jsonSchema: z.any(),
  handler: z.function({
    input: z.tuple([z.any()]),
    output: z.union([z.promise(z.string()), z.string()])
  })
});
type TTool = z.infer<typeof toolSchema>;

const modelSchema = z.object({
  id: z.string(),
  name: z.optional(z.string())
});
type TModel = z.infer<typeof modelSchema>;

export { modelSchema, providerSchema, toolSchema };
export type { TModel, TProvider, TTool };
