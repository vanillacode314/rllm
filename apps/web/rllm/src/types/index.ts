import * as z from 'zod/mini';

const providerSchema = z.object({
  baseUrl: z.url(),
  defaultModelIds: z.array(z.string()),
  id: z.string(),
  name: z.string(),
  token: z.string(),
  type: z.literal('openai')
});
type TProvider = z.infer<typeof providerSchema>;

const toolSchema = z.object({
  description: z.string(),
  handler: z.function({
    input: z.tuple([z.any()]),
    output: z.union([z.promise(z.string()), z.string()])
  }),
  // TODO: figure out z.any()
  jsonSchema: z.any(),
  name: z.string()
});
type TTool = z.infer<typeof toolSchema>;

const modelSchema = z.object({
  id: z.string(),
  name: z.optional(z.string())
});
type TModel = z.infer<typeof modelSchema>;

export { modelSchema, providerSchema, toolSchema };
export type { TModel, TProvider, TTool };
