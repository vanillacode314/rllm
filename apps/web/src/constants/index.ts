import { type } from 'arktype';

import type { TProvider, TTool } from '~/types';

const PROVIDERS = [
	{
		id: 'openrouter',
		name: 'OpenRouter',
		type: 'openai_compatible',
		baseUrl: 'https://openrouter.ai/api/v1',
		token: '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',
		defaultModelIds: ['nvidia/nemotron-nano-9b-v2:free', 'qwen/qwen3-coder']
	},
	{
		id: 'llamaswap',
		name: 'LlamaSwap',
		type: 'openai_compatible',
		baseUrl: 'http://localhost:6003/v1',
		token: '',
		defaultModelIds: ['gemma-3-4b']
	}
] satisfies TProvider[];

const TOOLS = [
	{
		name: 'add',
		description: 'Adds 2 numbers together',
		schema: type({
			numbers: type('number[]').describe('list of numbers to add together')
		}),
		handler: ({ numbers }: { numbers: number[] }) => {
			return numbers.reduce((acc, num) => acc + num, 0).toString();
		}
	}
] satisfies TTool[];

export { PROVIDERS, TOOLS };
