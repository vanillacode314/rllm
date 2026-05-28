import { AsyncResult, Option, Result } from 'ts-result-option';
import { ParseError, safeParseJson, tryBlock, ValidationError } from 'ts-result-option/utils';
import wretch, { type Wretch } from 'wretch';
import { abortAddon } from 'wretch/addons';
import { retry } from 'wretch/middlewares';
import * as z from 'zod/mini';

import type {
  TAdapter,
  TChatCompletionChunk,
  TChatCompletionLastChunk
} from '~/lib/adapters/types';
import type { TMessage } from '~/types/chat';

import { ProxyManager } from '~/lib/proxy';
import { modelSchema, type TModel, type TTool } from '~/types';
import { makeSSEParser } from '~/utils/response';

import {
  openaiChatCompletionResponseChunkSchema,
  type TOpenAIChatCompletionRequest,
  type TOpenAIChatCompletionResponseChunk,
  type TOpenAIChatCompletionResponseChunkDelta
} from './types';

export class OpenAIAdapter implements TAdapter {
  baseUrl: string;
  id = 'openai';
  #wretch: Wretch;
  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.#wretch = wretch(this.baseUrl)
      .auth(`Bearer ${token}`)
      .middlewares([ProxyManager.middleware()]);
  }
  fetchAllModels(): AsyncResult<TModel[], Error> {
    return tryBlock(
      this,
      async function* () {
        const text = await this.#wretch
          .middlewares([
            retry({
              maxAttempts: 3,
              delayRamp: (delay, nbOfAttempts) => Math.pow(2, nbOfAttempts) * delay,
              delayTimer: 2000
            })
          ])
          .get('/models')
          .text();

        const models = yield* safeParseJson(text, {
          validate: z.object({ data: z.array(modelSchema) }).parse
        }).map((value) => value.data);
        return Result.Ok(models);
      },
      (e) => (e instanceof Error ? e : new Error('Failed to fetch models', { cause: e }))
    );
  }

  async *generateCompletion(opts: {
    messages: TMessage[];
    model: string;
    reasoningEffort: 'high' | 'low' | 'medium' | 'minimal' | 'none' | 'xhigh';
    signal?: AbortSignal;
    system?: string;
    tools?: TTool[];
  }): AsyncGenerator<TChatCompletionChunk, TChatCompletionLastChunk, void> {
    const { messages, model, reasoningEffort, signal, system, tools } = opts;

    const requestBody = this.buildRequestBody({
      messages,
      model,
      reasoningEffort,
      system,
      tools
    });
    let stream = this.#wretch
      .middlewares([
        retry({
          maxAttempts: 3,
          delayRamp: (delay, nbOfAttempts) => Math.pow(2, nbOfAttempts) * delay,
          delayTimer: 2000,
          until: (response) =>
            Boolean(
              response &&
              (response.ok ||
                (response.status >= 400 && response.status < 500 && response.status !== 429))
            ),
          resolveWithLatestResponse: true
        })
      ])
      .addon(abortAddon());
    if (signal) stream = stream.signal({ signal, abort: () => {} });
    const response = await stream.post(requestBody, '/chat/completions').res();

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch chat completions`, {
        cause: `Response: ${text}`
      });
    }

    if (response.body === null) {
      throw new Error(`Failed to fetch chat completions`);
    }

    let lastToolCallId = Option.None<string>();
    for await (const [completion, abort] of this.processOpenAIAPIChatCompletionsStream(
      response.body
    )) {
      if (completion.isOkAnd((completion) => completion.error.isSome())) {
        return {
          finish_reason: 'error',
          error: new Error(completion.unwrap().error.unwrap().message)
        };
      }
      const choice = completion
        .unwrap()
        .choices.map((choices) => choices[0])
        .toNull();
      if (!choice) continue;
      const delta = choice.delta;
      if (delta.isSome()) {
        const content = this.processContentDelta(delta.unwrap());
        const reasoning = this.processReasoningDelta(delta.unwrap());
        const tools = this.processToolCallDelta(delta.unwrap(), lastToolCallId);
        lastToolCallId = tools
          .andThen((tools) => Option.from(tools.at(-1)))
          .map((tool) => tool.id)
          .or(lastToolCallId);
        yield { content, reasoning, tools };
      }
      if (choice.finish_reason.isNone()) continue;
      switch (choice.finish_reason.unwrap()) {
        case 'error': {
          return { finish_reason: 'error', error: completion };
        }
        case 'stop': {
          return { finish_reason: 'stop' };
        }
        case 'tool_calls': {
          return { finish_reason: 'tool_calls' };
        }
      }
    }
    throw new Error('No finish reason');
  }

  processContentDelta(delta: TOpenAIChatCompletionResponseChunkDelta) {
    return delta.content.filter((value) => value !== '');
  }

  async *processOpenAIAPIChatCompletionsStream(
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
          validate: openaiChatCompletionResponseChunkSchema.parse
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
        validate: openaiChatCompletionResponseChunkSchema.parse
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

  processReasoningDelta(delta: TOpenAIChatCompletionResponseChunkDelta) {
    return delta.reasoning.or(delta.reasoning_content).filter((value) => value !== '');
  }

  processToolCallDelta(
    delta: TOpenAIChatCompletionResponseChunkDelta,
    lastToolCallId: Option<string>
  ) {
    return delta.tool_calls.map((tool_calls) =>
      tool_calls.map((tool_call) => ({
        id: tool_call.id.unwrapOrElse(() => lastToolCallId.unwrap()),
        arguments: tool_call.function.andThen((f) => f.arguments),
        name: tool_call.function.andThen((f) => f.name)
      }))
    );
  }

  transformMessageChunksToRequestMessages(messages: TMessage[]) {
    const retval = [] as TOpenAIChatCompletionRequest['messages'][];
    let currentChunk = null as null | TOpenAIChatCompletionRequest['messages'];
    function commitChunk() {
      if (currentChunk === null) throw new Error('Cannot commit null chunk');
      retval.push(currentChunk);
      currentChunk = null;
    }
    function updateUserChunk(
      item: (TOpenAIChatCompletionRequest['messages'] & { role: 'user' })['content'][number]
    ) {
      if (currentChunk !== null && currentChunk.role !== 'user')
        throw new Error('Cannot update user chunk with non-user chunk');
      if (currentChunk === null) {
        currentChunk = {
          role: 'user',
          content: [item]
        };
        return;
      }
      currentChunk.content.push(item);
    }
    function updateAssistantChunk(item: {
      content?: string;
      reasoning_content?: string;
      tool_calls?: (TOpenAIChatCompletionRequest['messages'] & { role: 'assistant' })['tool_calls'];
    }) {
      const { content, reasoning_content, tool_calls } = item;
      if (currentChunk !== null && currentChunk.role !== 'assistant')
        throw new Error('Cannot update assistant chunk with non-assistant chunk');
      if (currentChunk === null) {
        currentChunk = {
          role: 'assistant',
          content: content ?? '',
          reasoning_content,
          tool_calls
        };
        return;
      }
      if (content !== undefined) currentChunk.content = content;
      if (reasoning_content !== undefined) currentChunk.reasoning_content = reasoning_content;
      if (tool_calls !== undefined) currentChunk.tool_calls = tool_calls;
    }
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      if (message.type === 'llm') {
        if (currentChunk !== null && currentChunk.role === 'user') commitChunk();
        for (const chunk of message.chunks) {
          if (chunk.type === 'reasoning') {
            if (i < messages.length - 1) continue;
            updateAssistantChunk({ reasoning_content: chunk.content });
          } else if (chunk.type === 'text') {
            updateAssistantChunk({ content: chunk.content });
          } else if (chunk.type === 'tool_call') {
            updateAssistantChunk({
              tool_calls: [
                {
                  id: chunk.id,
                  type: 'function',
                  function: {
                    name: chunk.tool.name,
                    arguments: chunk.tool.arguments
                  }
                }
              ]
            });
            commitChunk();
            currentChunk = {
              role: 'tool',
              name: chunk.tool.name,
              content: chunk.content,
              tool_call_id: chunk.id
            };
            commitChunk();
          }
        }
      } else if (message.type === 'user') {
        if (currentChunk !== null && currentChunk.role === 'assistant') commitChunk();
        for (const chunk of message.chunks) {
          updateUserChunk(
            chunk.type === 'image_url' ?
              { type: 'image_url', image_url: { url: chunk.url } }
            : { type: 'text', text: chunk.content }
          );
        }
      }
    }
    if (currentChunk !== null) commitChunk();
    return retval;
  }

  private buildRequestBody(opts: {
    messages: TMessage[];
    model: string;
    reasoningEffort?: string;
    system?: string;
    tools?: TTool[];
  }) {
    const { messages, model, reasoningEffort, system, tools } = opts;
    const serverMessages = this.transformMessageChunksToRequestMessages(messages);

    if (system !== undefined && system.trim().length > 0)
      serverMessages.unshift({
        role: 'system',
        content: system
      });

    if (serverMessages.length === 0) {
      throw new Error('No messages to send');
    }

    const requestBody: Record<string, unknown> = { model, messages: serverMessages, stream: true };

    if (reasoningEffort) {
      requestBody.reasoning_effort = reasoningEffort;
      // NOTE: google doesn't allow extra params in json body
      if (!this.baseUrl.startsWith('https://generativelanguage.googleapis.com/v1beta/openai')) {
        requestBody.reasoning = { effort: reasoningEffort };
        requestBody.chat_template_kwargs = { enable_thinking: reasoningEffort !== 'none' };
      }
    }

    if (tools)
      requestBody.tools = tools.map((tool) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.jsonSchema
        }
      }));
    return requestBody;
  }
}
