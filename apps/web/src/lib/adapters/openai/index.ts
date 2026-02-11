import { nanoid } from 'nanoid';
import { FetchError } from 'ofetch';
import { AsyncResult, Option, Result } from 'ts-result-option';
import { ParseError, safeParseJson, tryBlock, ValidationError } from 'ts-result-option/utils';

import type { TLLMMessageChunk, TMessage } from '~/types/chat';

import { makeAdapter } from '~/lib/adapters/utils';
import { formatError } from '~/utils/errors';
import { create } from '~/utils/mutative';
import { makeSSEParser } from '~/utils/response';

import {
	openaiChatCompletionResponseChunkSchema,
	type TOpenAIChatCompletionRequest,
	type TOpenAIChatCompletionResponseChunk,
	type TOpenAIChatCompletionResponseChunkDelta
} from './types';

const openAiAdapter = makeAdapter({
	id: 'openai',
	handleChatCompletion: ({ messages, onChunk, system, fetcher, model, signal, tools, onAbort }) =>
		tryBlock<void, Error>(
			async function* (): AsyncGenerator<Result<never, Error>, Result<void, Error>> {
				if (messages.length === 0) {
					return Result.Err(new Error('No messages to send'));
				}
				let serverMessages = transformMessageChunksToRequestMessages(messages);
				if (system !== undefined)
					serverMessages.unshift({
						role: 'system',
						content: system
					});
				if (serverMessages.length === 0) {
					serverMessages = transformMessageChunksToRequestMessages(messages, {
						includeReasoning: true
					});
				}
				if (serverMessages.length === 0) {
					return Result.Err(new Error('No messages to send'));
				}

				const stream = yield* fetcher('/chat/completions', {
					method: 'POST',
					body: {
						model,
						messages: serverMessages,
						stream: true,
						tools: tools
							.map((tools) =>
								tools.map((tool) => ({
									type: 'function',
									function: {
										name: tool.name,
										description: tool.description,
										parameters: tool.schema.toJsonSchema()
									}
								}))
							)
							.toUndefined()
					},
					signal: signal.toUndefined(),
					responseType: 'stream',
					onRequestError() {
						signal.zip(onAbort).inspect(([signal, onAbort]) => {
							if (signal.aborted) onAbort();
						});
					}
				}).mapErr(async (e) => {
					if (e instanceof FetchError && e.response) {
						const text = await e.response.text();
						return new Error(`Failed to fetch chat completions`, {
							cause: `Response: ${text}`
						});
					}
					return new Error(`Failed to fetch chat completions`, { cause: e });
				});
				let lastToolCallId: Option<string> = Option.None();
				const localToolCalls = new Map<
					string,
					{
						function: {
							arguments: string;
							name: string;
						};
						id: string;
						result: Option<string>;
						success: boolean;
					}
				>();
				for await (const [completion, abort] of processOpenAIAPIChatCompletionsStream(stream)) {
					if (signal.isSomeAnd((signal) => signal.aborted)) {
						onAbort.inspect((onAbort) => onAbort());
						return Result.Ok();
					}
					const choice = (yield* completion).choices[0];
					if (!choice) continue;
					const delta = choice.delta;
					if (delta.isSome()) {
						const lastMessage = messages.at(-1)!;
						if (lastMessage.type !== 'llm')
							return Result.Err(new Error('Last message must be an LLM message'));
						const { chunks: newChunks, lastToolCallId: newLastToolCallId } = handleDelta(
							lastMessage.chunks,
							delta.unwrap(),
							localToolCalls,
							lastToolCallId
						);
						messages = create(messages, (messages) => {
							messages.at(-1)!.chunks = newChunks;
						});
						lastToolCallId = newLastToolCallId;
						onChunk.inspect((onChunk) => onChunk(newChunks));
					}

					if (choice.finish_reason.isNone()) continue;
					switch (choice.finish_reason.unwrap()) {
						case 'error': {
							return Result.Err(new Error('Error in chat completion', { cause: completion }));
						}
						case 'stop': {
							abort();
							break;
						}
						case 'tool_calls': {
							for (const call of localToolCalls.values()) {
								if (signal.isSomeAnd((signal) => signal.aborted)) {
									onAbort.inspect((onAbort) => onAbort());
									return Result.Ok();
								}
								const result = tools!
									.andThen((tools) =>
										Option.fromUndefined(tools.find((tool) => tool.name === call.function.name))
									)
									.okOrElse(
										() =>
											new Error(
												`Tool with name ${call.function.name} not found. Expected one of (${tools
													.unwrap()
													.map((tool) => tool.name)
													.join(', ')})`
											)
									)
									.andThen((tool) =>
										safeParseJson(call.function.arguments, {
											validate: tool.schema.assert
										})
											.context('Invalid arguments for tool')
											.map((args) => ({ tool, args }))
									)
									.toAsync()
									.andThen(({ args, tool }) => {
										return AsyncResult.from(
											() => Promise.try(tool.handler, args),
											(e) => new Error(`Failed to execute tool`, { cause: e })
										).inspectErr(console.log);
									});

								await result.match(
									(value) => (call.result = Option.Some(value)),
									(error) => (call.result = Option.Some(formatError(error)))
								);
							}

							const newMessages = create(messages, (chunks) => {
								const subchunks = chunks
									.values()
									.filter((chunk) => chunk.type === 'llm')
									.flatMap((chunk) => chunk.chunks);
								for (const chunk of subchunks) {
									if (chunk.type === 'tool_call') {
										if (chunk.finished) continue;
										chunk.success = true;
										const call = Option.fromUndefined(localToolCalls.get(chunk.tool_call_id));
										chunk.content = call.andThen((call) => call.result).unwrapOr('');
									}

									if (chunk.type === 'reasoning' || chunk.type === 'tool_call')
										chunk.finished = true;
								}
							});

							onChunk.inspect((onChunk) =>
								onChunk((newMessages.at(-1) as TMessage & { type: 'llm' }).chunks)
							);

							return openAiAdapter.handleChatCompletion({
								messages: newMessages,
								onChunk,
								fetcher,
								model,
								signal,
								tools,
								onAbort
							});
						}
					}
				}
				return Result.Ok();
			},
			(e) => new Error(`Failed to fetch chat completions`, { cause: e })
		),
	processContentDelta: (delta: TOpenAIChatCompletionResponseChunkDelta) =>
		delta.content.filter((value) => value !== ''),
	processToolCallDelta: (delta: TOpenAIChatCompletionResponseChunkDelta) =>
		delta.tool_calls.unwrapOr([]),
	processReasoningDelta: (delta: TOpenAIChatCompletionResponseChunkDelta) =>
		delta.reasoning.or(delta.reasoning_content).filter((value) => value !== '')
});

function handleDelta(
	chunks: TLLMMessageChunk[],
	delta: TOpenAIChatCompletionResponseChunkDelta,
	localToolCalls: Map<
		string,
		{
			function: {
				arguments: string;
				name: string;
			};
			id: string;
			result: Option<string>;
			success: boolean;
		}
	>,
	lastToolCallId: Option<string>
): { chunks: TLLMMessageChunk[]; lastToolCallId: Option<string> } {
	if (delta.tool_calls.isSome()) {
		const serverCalls = openAiAdapter.processToolCallDelta(delta);
		let newToolCallId = Option.None<string>();
		const newChunks = create(chunks, (chunks) => {
			for (const serverCall of serverCalls) {
				const name = Option.from(serverCall.function).andThen((f) => f.name);
				const args = Option.from(serverCall.function).andThen((f) => f.arguments);
				const didLastToolFinish = lastToolCallId
					.zip(serverCall.id)
					.isSomeAnd(([lastToolCallId, serverCallId]) => lastToolCallId !== serverCallId);
				if (didLastToolFinish) {
					const lastChunk = Option.fromUndefined(chunks.at(-1)).expect(
						'should be defined since we have a lastToolCallId set'
					);
					if (lastChunk.type === 'tool_call') lastChunk.finished = true;

					if (serverCall.id.isNone()) {
						console.warn('Last tool finished but new tool is None');
						continue;
					}

					const id = serverCall.id.unwrap();
					const existingToolCall = Option.from(localToolCalls.get(id));

					existingToolCall.zip(args).inspect(([existingToolCall, args]) => {
						existingToolCall.function.arguments += args;
					});
				} else {
					newToolCallId = lastToolCallId.or(serverCall.id);
					if (newToolCallId.isNone()) {
						console.warn('No tool call id');
						continue;
					}
					const id = newToolCallId.unwrap();
					const hasSeenToolBefore = localToolCalls.has(id);
					if (!hasSeenToolBefore) {
						const call = {
							id,
							function: {
								name: name.unwrapOr(''),
								arguments: args.unwrapOr('')
							},
							success: false,
							result: Option.None<string>()
						};
						localToolCalls.set(id, call);
						chunks.push({
							id: nanoid(),
							tool_call_id: id,
							type: 'tool_call',
							tool: {
								name: call.function.name,
								arguments: call.function.arguments
							},
							finished: false,
							success: false,
							content: ''
						});
					} else {
						const existingChunk = chunks.at(-1)!;
						if (existingChunk.type !== 'tool_call') {
							console.warn('Expected tool call chunk');
							continue;
						}
						const existingToolCall = localToolCalls.get(id)!;
						args.inspect((value) => {
							existingToolCall.function.arguments += value;
							existingChunk.tool.arguments = existingToolCall.function.arguments;
						});
					}
				}
			}
		});
		return { chunks: newChunks, lastToolCallId: newToolCallId };
	}

	const newChunks = create(chunks, (draft) => {
		const lastChunk = Option.fromUndefined(draft.at(-1));

		const content = openAiAdapter.processContentDelta(delta);
		const reasoning = openAiAdapter.processReasoningDelta(delta);

		const deltaHasOpeningThinkTag = content.isSomeAnd((value) => value.includes('<think>'));
		const deltaHasClosingThinkTag = content.isSomeAnd((value) => value.includes('</think>'));

		lastChunk.inspect((chunk) => {
			if (chunk.type !== 'reasoning') return;
			chunk.finished ||=
				chunk.wasStartedByThinkTag ?
					deltaHasClosingThinkTag || content.isNone()
				:	reasoning.isNone();
		});

		const hasReasoning =
			reasoning.isSome() ||
			deltaHasOpeningThinkTag ||
			lastChunk.isSomeAnd((chunk) => chunk.type === 'reasoning' && !chunk.finished);

		outer: if (hasReasoning) {
			const shouldCreateNewChunk = lastChunk.isNoneOr((chunk) => chunk.type !== 'reasoning');
			const chunkToUse: TLLMMessageChunk =
				shouldCreateNewChunk ?
					makeNewLLMMessageChunk('reasoning', deltaHasOpeningThinkTag)
				:	lastChunk.unwrap();
			if (shouldCreateNewChunk) draft.push(chunkToUse);
			const text = reasoning.or(
				content.map((content) => {
					if (deltaHasOpeningThinkTag) {
						const startIndex = content.indexOf('<think>') + '<think>'.length;
						content = content.slice(startIndex);
					}
					if (deltaHasClosingThinkTag) {
						const endIndex = content.indexOf('</think>');
						content = content.slice(0, endIndex);
					}
					return content;
				})
			);
			const shouldAppend =
				text.isSome() && chunkToUse.content.trim().length + text.unwrap().trim().length > 0;
			if (!shouldAppend) break outer;
			chunkToUse.content += text.unwrap();
		}

		const hasContent =
			content.isSome() &&
			lastChunk.isNoneOr(
				(chunk) => chunk.type !== 'reasoning' || chunk.finished || !chunk.wasStartedByThinkTag
			);

		outer: if (hasContent) {
			const shouldCreateNewChunk = lastChunk.isNoneOr((chunk) => chunk.type !== 'text');
			const chunkToUse: TLLMMessageChunk =
				shouldCreateNewChunk ? makeNewLLMMessageChunk('text') : lastChunk.unwrap();
			if (shouldCreateNewChunk) draft.push(chunkToUse);
			const shouldAppend =
				content.isSome() && chunkToUse.content.trim().length + content.unwrap().trim().length > 0;
			if (!shouldAppend) break outer;
			chunkToUse.content += content.unwrap();
		}
	});
	return { chunks: newChunks, lastToolCallId };
}

function makeNewLLMMessageChunk(type: 'reasoning', wasStartedByThinkTag: boolean): TLLMMessageChunk;
function makeNewLLMMessageChunk(type: 'text'): TLLMMessageChunk;
function makeNewLLMMessageChunk(
	type: 'reasoning' | 'text',
	wasStartedByThinkTag: boolean = false
): TLLMMessageChunk {
	return type === 'reasoning' ?
			{ id: nanoid(), type, content: '', finished: false, wasStartedByThinkTag }
		:	{ id: nanoid(), type, content: '' };
}

async function* processOpenAIAPIChatCompletionsStream(
	stream: ReadableStream
): AsyncGenerator<[Result<TOpenAIChatCompletionResponseChunk, Error>, () => void]> {
	const decoder = new TextDecoder();
	const reader = stream.getReader();
	const controller = new AbortController();
	const parser = makeSSEParser();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (controller.signal.aborted) break;
		const text = decoder.decode(value, { stream: true });
		const events = parser.feed(text);
		for (const event of events) {
			if (event.data === '[DONE]') {
				controller.abort();
				break;
			}

			const completion = safeParseJson(event.data, {
				validate: openaiChatCompletionResponseChunkSchema.assert
			}).inspectErr((e) => {
				if (e instanceof ParseError) {
					console.log('[Completion Parse Error]', e.text);
				} else if (e instanceof ValidationError) {
					console.log('[Completion Validation Error]', e.input);
				}
			});
			yield [completion, () => controller.abort()];
		}
	}
	const remainingEvents = parser.flush();
	for (const event of remainingEvents) {
		if (event.data === '[DONE]') continue;
		const completion = safeParseJson(event.data, {
			validate: openaiChatCompletionResponseChunkSchema.assert
		}).inspectErr((e) => {
			if (e instanceof ParseError) {
				console.log('[Completion Parse Error]', e.text);
			} else if (e instanceof ValidationError) {
				console.log('[Completion Validation Error]', e.input);
			}
		});
		yield [completion, () => controller.abort()];
	}
	await reader.cancel();
}

function transformMessageChunksToRequestMessages(
	messages: TMessage[],
	config: { includeReasoning?: boolean } = { includeReasoning: false }
) {
	const retval = [] as TOpenAIChatCompletionRequest['messages'];
	for (const message of messages) {
		if (message.type === 'llm') {
			for (const chunk of message.chunks) {
				if (chunk.type === 'reasoning') {
					if (!config.includeReasoning) continue;
					retval.push({
						role: 'assistant',
						content: chunk.content
					});
				} else if (chunk.type === 'text') {
					retval.push({
						role: 'assistant',
						content: chunk.content
					});
				} else if (chunk.type === 'tool_call') {
					retval.push(
						{
							role: 'assistant',
							content: '',
							tool_calls: [
								{
									id: chunk.tool_call_id,
									type: 'function',
									function: {
										name: chunk.tool.name,
										arguments: chunk.tool.arguments
									}
								}
							]
						},
						{
							role: 'tool',
							name: chunk.tool.name,
							content: chunk.content,
							tool_call_id: chunk.tool_call_id
						}
					);
				}
			}
		} else if (message.type === 'user') {
			for (const chunk of message.chunks) {
				if (chunk.type === 'image_url') {
					retval.push({
						role: 'user',
						content: [{ type: 'image_url', image_url: { url: chunk.url } }]
					});
				} else {
					retval.push({
						role: 'user',
						content: chunk.content
					});
				}
			}
		}
	}
	return retval;
}

export { openAiAdapter };
