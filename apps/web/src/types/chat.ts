import { type } from 'arktype';

import { Tree, type TTree } from '~/utils/tree';

const llmMessageChunkSchema = type({
	id: 'string',
	type: "'text'",
	content: 'string'
})
	.or({
		id: 'string',
		type: "'reasoning'",
		content: 'string',
		finished: 'boolean',
		wasStartedByThinkTag: 'boolean = false'
	})
	.or({
		id: 'string',
		tool_call_id: 'string',
		type: "'tool_call'",
		content: 'string',
		tool: {
			name: 'string',
			arguments: 'string'
		},
		finished: 'boolean',
		success: 'boolean'
	});
type TLLMMessageChunk = typeof llmMessageChunkSchema.infer;

const userMessageChunkSchema = type({
	id: 'string',
	type: "'text'",
	content: 'string'
})
	.or({
		id: 'string',
		type: "'user_tool_call'",
		content: 'string'
	})
	.or({
		id: 'string',
		type: "'image_url'",
		url: 'string.url',
		filename: 'string > 0',
		mimeType: 'string > 0'
	});
type TUserMessageChunk = typeof userMessageChunkSchema.infer;

const messageSchema = type({
	type: "'llm'",
	model: 'string',
	provider: 'string',
	finished: 'boolean',
	'error?': 'string',
	chunks: llmMessageChunkSchema.array()
}).or({
	type: "'user'",
	chunks: userMessageChunkSchema.array()
});
type TMessage = typeof messageSchema.infer;

const chatSchema = type({
	id: 'string',
	title: 'string',
	finished: 'boolean',
	tags: 'string[]',
	settings: {
		model: 'string',
		providerId: 'string',
		systemPrompt: 'string = ""'
		// 'temperature?': 'number'
		// "topP?": "number",
		// "frequencyPenalty?": "number",
		// "presencePenalty?": "number",
		// "maxTokens?": "number",
		// "stop?": "string[]",
	},
	messages: type.instanceOf(Tree).as<TTree<TMessage>>()
});
type TChat = typeof chatSchema.infer;

const attachmentsSchema = type({
	description: 'string',
	documents: type({
		content: 'string',
		embeddings: 'number[]',
		index: 'number.integer > 0'
	}).array(),
	progress: '0 <= number <= 1',
	id: 'string'
});

type TAttachment = typeof attachmentsSchema.infer;

export {
	attachmentsSchema,
	chatSchema,
	llmMessageChunkSchema,
	messageSchema,
	userMessageChunkSchema
};
export type { TAttachment, TChat, TLLMMessageChunk, TMessage, TUserMessageChunk };
