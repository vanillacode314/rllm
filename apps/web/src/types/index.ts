import { type } from 'arktype';

const providerSchema = type({
	id: 'string',
	name: 'string',
	type: "'openai'",
	baseUrl: 'string.url',
	token: 'string',
	defaultModelIds: 'string[]'
});
type TProvider = typeof providerSchema.infer;

const toolSchema = type({
	name: 'string',
	description: 'string',
	schema: type.unknown.as<type.Any>(),
	handler: type('Function').as<(input: any) => Promise<string> | string>()
});
type TTool = typeof toolSchema.infer;

const modelSchema = type({
	id: 'string',
	'name?': 'string'
});
type TModel = typeof modelSchema.infer;

export { modelSchema, providerSchema, toolSchema };
export type { TModel, TProvider, TTool };
