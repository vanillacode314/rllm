import { type } from 'arktype';
import { Option } from 'ts-result-option';

import { asOption } from '~/utils/arktype';

const openaiModelSchema = type({
	id: 'string',
	'name?': 'string'
});
type TOpenAIModel = typeof openaiModelSchema.infer;

const openaiChatCompletionRequestSchema = type({
	model: 'string',
	messages: type({
		role: "'system'",
		content: 'string'
	})
		.or({
			role: "'user'",
			content: type('string').or(
				type({
					type: "'text'",
					text: 'string'
				})
					.or({
						type: "'image_url'",
						image_url: type({
							url: 'string.url'
						})
					})
					.array()
			)
		})
		.or({
			role: "'tool'",
			content: 'string',
			name: 'string',
			tool_call_id: 'string'
		})
		.or({
			role: "'assistant'",
			content: 'string',
			'tool_calls?': type({
				id: 'string',
				type: 'string',
				function: {
					name: 'string',
					arguments: 'string'
				}
			}).array()
		})
		.array(),
	stream: 'boolean',
	tools: type({
		type: "'function'",
		function: type({
			name: 'string',
			description: 'string',
			parameters: 'object'
		})
	}).array()
});
type TOpenAIChatCompletionRequest = typeof openaiChatCompletionRequestSchema.infer;

const openaiToolCallResponseSchema = type({
	'id?': asOption('string'),
	function: type({
		'name?': 'string | null | undefined',
		'arguments?': 'string | null | undefined'
	})
		.or('null')
		.pipe((value) => {
			if (value === null) return value;
			return {
				name: Option.from(value.name),
				arguments: Option.from(value.arguments)
			};
		})
}).pipe((value) =>
	Object.assign(
		{
			id: Option.None<string>()
		},
		value
	)
);
type TOpenAIToolCallResponse = typeof openaiToolCallResponseSchema.inferOut;

const openaiChatCompletionResponseChunkDeltaSchema = type({
	'role?': asOption('string'),
	'content?': asOption('string'),
	'reasoning?': asOption('string'),
	'reasoning_content?': asOption('string'),
	'tool_calls?': asOption('unknown[]').pipe((value) =>
		value.map((tool_calls) => tool_calls.map((value) => openaiToolCallResponseSchema.assert(value)))
	)
}).pipe((value) =>
	Object.assign(
		{
			role: Option.None<string>(),
			content: Option.None<string>(),
			reasoning: Option.None<string>(),
			reasoning_content: Option.None<string>(),
			tool_calls: Option.None<TOpenAIToolCallResponse[]>()
		},
		value
	)
);
type TOpenAIChatCompletionResponseChunkDelta =
	typeof openaiChatCompletionResponseChunkDeltaSchema.infer;

const openaiChatCompletionResponseChunkSchema = type({
	choices: type({
		'finish_reason?': asOption('"stop" | "tool_calls" | "error"'),
		'delta?': asOption(openaiChatCompletionResponseChunkDeltaSchema)
	})
		.pipe((value) =>
			Object.assign(
				{
					delta: Option.None<TOpenAIChatCompletionResponseChunkDelta>(),
					finish_reason: Option.None<'error' | 'stop' | 'tool_calls'>()
				},
				value
			)
		)
		.array()
});
type TOpenAIChatCompletionResponseChunk = typeof openaiChatCompletionResponseChunkSchema.infer;

export {
	openaiChatCompletionRequestSchema,
	openaiChatCompletionResponseChunkDeltaSchema,
	openaiChatCompletionResponseChunkSchema,
	openaiModelSchema,
	openaiToolCallResponseSchema
};
export type {
	TOpenAIChatCompletionRequest,
	TOpenAIChatCompletionResponseChunk,
	TOpenAIChatCompletionResponseChunkDelta,
	TOpenAIModel,
	TOpenAIToolCallResponse
};
