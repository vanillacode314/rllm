import type { $Fetch } from 'ofetch';

import { type } from 'arktype';
import { nanoid } from 'nanoid';
import { AsyncResult, Option } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';

import type { TMessage } from '~/types/chat';

import type { TAdapter } from './types';

const OUTPUT_JSON_REGEX = /{\s*"title"\s*:\s*".*"\s*}/m;
const generateTitle = (adapter: TAdapter, fetcher: $Fetch, model: string, chunks: TMessage[]) =>
	tryBlock<string, Error>(
		async function* () {
			let output = '';
			yield* await adapter.handleChatCompletion({
				chunks: [
					...chunks,
					{
						type: 'user',
						chunks: [
							{
								id: nanoid(),
								type: 'text',
								content: `
Task: Generate a concise 3-5 word title for the conversation we just had before this message. The goal of the title is for the user to be able to find this conversation easily later on by just looking at the title. Feel free to use an emoji prefix if it would help with the goal. Output as json, only output the json
Output Schema: { "title": string }
Example Outputs:
  - { "title": "🥪 How to make a sandwich" }
  - { "title": "Learning Rust" }
  - { "title": "🌐 How to make a website" }
  - { "title": "News about neovim" }
`.trim()
							}
						]
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
				onAbort: Option.None(),
				signal: Option.None()
			});
			const json = OUTPUT_JSON_REGEX.exec(output)?.[0];
			if (!json) throw new Error(`Failed to extract json from output: ${output}`);
			const { title } = yield* safeParseJson(json, {
				validate: type({ title: 'string' }).assert
			});
			return AsyncResult.Ok(title);
		},
		(e) => new Error(`Failed to generate title`, { cause: e })
	);

export { generateTitle };
