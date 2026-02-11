import { nanoid } from 'nanoid';
import { AsyncResult } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import type { TMessage } from '~/types/chat';

import { OpenAIAdapter } from '~/lib/adapters/openai';
import { fetchers } from '~/queries';
import { type TTool } from '~/types';
import { produce } from '~/utils/immer';
import { dedent, extractFirstJson } from '~/utils/string';

import { handleCompletion } from '.';

export const generateTitleAndTags = (config: {
  chunks: TMessage[];
  model: string;
  providerId: string;
  signal?: AbortSignal;
  tags: string[];
}) =>
  tryBlock<{ tags: string[]; title: string }, Error>(
    async function* () {
      const outputSchema = z.object({ title: z.string(), tags: z.array(z.string()) });
      const { signal } = config;
      const [{ provider, providerId }, model] = await Promise.all([
        fetchers.userMetadata
          .byId('title-generation-provider-id')
          .then(async (titleGenerationProviderId) => {
            if (!titleGenerationProviderId) titleGenerationProviderId = config.providerId;
            const provider = await fetchers.providers.byId(titleGenerationProviderId);
            return { providerId: titleGenerationProviderId, provider };
          }),
        fetchers.userMetadata.byId('title-generation-model-id').then((id) => id ?? config.model)
      ]);
      if (!provider) throw new Error(`Provider ${providerId} not found`);
      if (!model) throw new Error(`Model ${model} not found`);
      const adapter = new OpenAIAdapter(provider.baseUrl, provider.token);
      const tagsPrompt =
        config.tags.length > 0 ?
          `\n              - These are the tags that the user has already used in the past, you can use them if they are relevant to the conversation or add new ones if they help with the goal: ${config.tags.join(', ')}`
        : '';
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
      const chunks = produce(config.chunks, (chunks) => {
        for (const chunk of chunks) {
          if (chunk.type === 'user') {
            chunk.chunks = chunk.chunks.filter(
              (chunk) => chunk.type !== 'image_url' && chunk.content.trim().length > 0
            );
          }
        }
      });
      let output = '';
      yield* handleCompletion({
        adapter,
        signal,
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
        model,
        onChunk: async (chunks) => {
          if (chunks.length === 0) return;
          const chunk = chunks.at(-1)!;
          if (chunk.type !== 'text') return;
          output = chunk.content;
        }
      });
      const json = extractFirstJson(output);
      if (!json) throw new Error(`Failed to extract json from output: ${output}`);
      const { title, tags } = yield* safeParseJson(json, { validate: outputSchema.parse });
      return AsyncResult.Ok({ title, tags });
    },
    (e) => new Error(`Failed to generate title`, { cause: e })
  );

export const summarizeChat = (config: {
  chunks: TMessage[];
  model: string;
  providerId: string;
  signal?: AbortSignal;
}) =>
  tryBlock<string, Error>(
    async function* () {
      const outputSchema = z.object({ summary: z.string() });
      const { model, providerId, signal } = config;
      const provider = await fetchers.providers.byId(providerId);
      if (!provider) throw new Error(`Provider ${providerId} not found`);
      const adapter = new OpenAIAdapter(provider.baseUrl, provider.token);
      const prompt = dedent`
          Task: Provide a detailed but concise summary of our conversation above. Focus on information that would be helpful for continuing the conversation, including what we did and what we're doing. Do not mention "the conversation", just include the information. Feel free to use markdown if that helps with the goal.
          Output Schema: { "summary": string }
        `;
      const chunks = produce(config.chunks, (chunks) => {
        for (const chunk of chunks) {
          if (chunk.type === 'user') {
            chunk.chunks = chunk.chunks.filter(
              (chunk) => chunk.type !== 'image_url' && chunk.content.trim().length > 0
            );
          }
        }
      });
      let output = '';
      yield* handleCompletion({
        adapter,
        signal,
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
        model,
        onChunk: async (chunks) => {
          if (chunks.length === 0) return;
          const chunk = chunks.at(-1)!;
          if (chunk.type !== 'text') return;
          output = chunk.content;
        }
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

export function makeTool(
  tool: Omit<TTool, 'jsonSchema'> & {
    inputSchema: z.core.$ZodType;
  }
): TTool {
  return { ...tool, jsonSchema: z.toJSONSchema(tool.inputSchema) };
}
