import { type } from 'arktype';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { type FetchOptions, ofetch } from 'ofetch';
import { AsyncResult, Option } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';
import { z } from 'zod/mini';

import type { TMessage } from '~/types/chat';

import { fetchers } from '~/queries';
import { modelSchema, type TModel } from '~/types';
import { dedent, extractFirstJson } from '~/utils/string';

import type { $ResultFetcher, TAdapter } from './types';

const generateTitleAndTags = (config: {
	adapter: TAdapter;
	chunks: TMessage[];
	model: string;
	providerId: string;
	signal?: AbortSignal;
	tags: string[];
}) =>
	tryBlock<{ tags: string[]; title: string }, Error>(
		async function* () {
			const outputSchema = z.object({ title: z.string(), tags: z.array(z.string()) });
			const { adapter, signal } = config;
			const [{ provider, providerId }, model] = await Promise.all([
				fetchers.userMetadata.byId('title-generation-provider-id').then(async (id) => {
					if (!id) return { providerId: id, provider: config.providerId };
					const provider = await fetchers.providers.byId(id);
					return { providerId: id, provider };
				}),
				fetchers.userMetadata.byId('title-generation-model-id').then((id) => id ?? config.model)
			]);
			if (!provider) throw new Error(`Provider ${providerId} not found`);
			if (!model) throw new Error(`Model ${model} not found`);
			// FIXME: use cors proxy
			const fetcher = adapter.makeFetcher(provider.baseUrl, provider.token);
			const tagsPrompt =
				config.tags.length > 0 ?
					`\n              - These are the tags that the user has already used in the past, you can use them if they are relevant to the conversation or add new ones if they help with the goal: ${config.tags.join(', ')}`
				:	'';
			const prompt = dedent`
            Task: 
              - Generate a concise 3-5 word title and tags for the conversation we just had before this message. 
              - The goal of the title and tags is for the user to be able to find this conversation easily later on by just looking at the title or searching for tags. 
              - Feel free to use an emoji prefix in the title if it would help with the goal. 
              - Only output the json${tagsPrompt}
            Output Schema: { "title": string, "tags": string[]" }
            Example Outputs:
              - { "title": "🥪 How to make a sandwich", "tags": ["Recipe", "Cooking", "Sandwich"] }
              - { "title": "Learning Rust", "tags": ["Programming", "Rust", "Learning"] }
              - { "title": "🌐 How to make a website", "tags": ["Programming", "Web Development"] }
              - { "title": "News about neovim", "tags": ["Neovim", "News", "Editor"] }
          `;
			const chunks = create(config.chunks, (chunks) => {
				for (const chunk of chunks) {
					if (chunk.type === 'user') {
						chunk.chunks = chunk.chunks.filter(
							(chunk) => chunk.type !== 'image_url' && chunk.content.trim().length > 0
						);
					}
				}
			});
			let output = '';
			yield* await adapter.handleChatCompletion({
				signal: Option.from(signal),
				messages: [
					...chunks,
					{
						type: 'user',
						chunks: [
							{
								id: nanoid(),
								type: 'text',
								content: prompt
							}
						]
					},
					{
						type: 'llm',
						model,
						provider: providerId,
						chunks: [],
						finished: false
					}
				],
				fetcher,
				model,
				tools: Option.Some([]),
				onChunk: Option.Some(async (chunks) => {
					if (chunks.length === 0) return;
					const chunk = chunks.at(-1)!;
					if (chunk.type !== 'text') return;
					output = chunk.content;
				}),
				onAbort: Option.None()
			});
			const json = extractFirstJson(output);
			if (!json) throw new Error(`Failed to extract json from output: ${output}`);
			const { title, tags } = yield* safeParseJson(json, { validate: outputSchema.parse });
			return AsyncResult.Ok({ title, tags });
		},
		(e) => new Error(`Failed to generate title`, { cause: e })
	);

const summarizeChat = (config: {
	adapter: TAdapter;
	chunks: TMessage[];
	fetcher: $ResultFetcher;
	model: string;
	providerId: string;
	signal?: AbortSignal;
}) =>
	tryBlock<string, Error>(
		async function* () {
			const outputSchema = z.object({ summary: z.string() });
			const { adapter, model, providerId, signal } = config;
			const provider = await fetchers.providers.byId(providerId);
			if (!provider) throw new Error(`Provider ${providerId} not found`);
			// FIXME: use cors proxy
			const fetcher = adapter.makeFetcher(provider.baseUrl, provider.token);
			const prompt = dedent`
          Task: Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did and what we're doing. Do not mention "the conversation", just include the information. Feel free to use markdown if that helps with the goal.
          Output Schema: { "summary": string }
        `;
			const chunks = create(config.chunks, (chunks) => {
				for (const chunk of chunks) {
					if (chunk.type === 'user') {
						chunk.chunks = chunk.chunks.filter(
							(chunk) => chunk.type !== 'image_url' && chunk.content.trim().length > 0
						);
					}
				}
			});
			let output = '';
			yield* adapter.handleChatCompletion({
				signal: Option.from(signal),
				messages: [
					...chunks,
					{
						type: 'user',
						chunks: [
							{
								id: nanoid(),
								type: 'text',
								content: prompt
							}
						]
					},
					{
						type: 'llm',
						model,
						provider: providerId,
						chunks: [],
						finished: false
					}
				],
				fetcher,
				model,
				tools: Option.Some([]),
				onChunk: Option.Some(async (chunks) => {
					if (chunks.length === 0) return;
					const chunk = chunks.at(-1)!;
					if (chunk.type !== 'text') return;
					output = chunk.content;
				}),
				onAbort: Option.None()
			});
			const json = extractFirstJson(output);
			if (!json) throw new Error(`Failed to extract json from output: ${output}`);
			const { summary } = yield* safeParseJson(json, {
				validate: outputSchema.parse
			});
			return AsyncResult.Ok(summary);
		},
		(e) => new Error(`Failed to summarize chat`, { cause: e })
	);

const baseAdapter = Object.freeze({
	fetchAllModels(fetcher: $ResultFetcher, opts: FetchOptions<'json'> = {}) {
		return fetcher<{ data: TModel[] }>('/models', {
			...opts,
			parseResponse: (text) =>
				safeParseJson(text, {
					validate: type({ data: modelSchema.array() }).assert
				})
		})
			.map((value) => value.data)
			.context('Failed to fetch models');
	},
	makeFetcher(baseUrl?: string, token?: string): $ResultFetcher {
		return AsyncResult.wrap(
			ofetch.create({
				baseURL: baseUrl ?? 'https://api.openai.com/v1',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token ?? ''}`
				}
			}),
			(e) => e
		) as $ResultFetcher;
	}
}) satisfies Partial<TAdapter>;

const makeAdapter = (
	adapter: Omit<TAdapter, keyof typeof baseAdapter> & Partial<typeof baseAdapter>
) => {
	return Object.freeze({
		...baseAdapter,
		...adapter
	});
};

export { generateTitleAndTags, makeAdapter, summarizeChat };
