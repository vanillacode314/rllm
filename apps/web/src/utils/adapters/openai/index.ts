import { type } from 'arktype'
import { nanoid } from 'nanoid'
import { ofetch } from 'ofetch'
import { AsyncResult, Err, Option, Result } from 'ts-result-option'
import {
  ParseError,
  safeParseJson,
  tryBlock,
  ValidationError,
} from 'ts-result-option/utils'

import type { TLLMMessageChunk, TMessage } from '~/types/chat'
import type { TAdapter } from '~/utils/adapters/types'

import { modelSchema, type TModel } from '~/types'
import { formatError } from '~/utils/errors'
import { create } from '~/utils/mutative'
import { parseSSEEventChunk } from '~/utils/response'

import {
  openaiChatCompletionResponseChunkSchema,
  type TOpenAIChatCompletionRequest,
  type TOpenAIChatCompletionResponseChunk,
  type TOpenAIChatCompletionResponseChunkDelta,
} from './types'

const openAiAdapter = {
  id: 'openai',
  fetchAllModels: (fetcher, { signal } = {}) => {
    return AsyncResult.fromPromise(
      () =>
        fetcher<{ data: TModel[] }>('/models', {
          signal,
          parseResponse: (text) =>
            safeParseJson(text, {
              validate: type({ data: modelSchema.array() }).assert,
            }),
        }),
      (e) => new Error(`Failed to fetch models`, { cause: e }),
    ).map((value) => value.data)
  },
  makeFetcher: (baseURL, token) =>
    ofetch.create({
      baseURL: baseURL.unwrapOr('https://api.openai.com/v1'),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.unwrapOr('')}`,
      },
    }),
  handleChatCompletion: ({
    chunks,
    onChunk,
    system,
    fetcher,
    model,
    signal,
    tools,
    onAbort,
  }) =>
    tryBlock<void, Error>(
      async function* (): AsyncGenerator<Err<unknown, Error>, void> {
        let messages = transformMessageChunksToRequestMessages(chunks)
        if (system !== undefined)
          messages.unshift({
            role: 'system',
            content: system,
          })
        if (messages.length === 0) {
          messages = transformMessageChunksToRequestMessages(chunks, {
            includeReasoning: true,
          })
        }
        if (messages.length === 0) {
          yield* AsyncResult.Err(new Error('No messages to send'))
        }

        const stream = yield* AsyncResult.fromThrowable(
          () =>
            fetcher('/chat/completions', {
              method: 'POST',
              body: {
                model,
                messages,
                stream: true,
                tools: tools
                  .map((tools) =>
                    tools.map((tool) => ({
                      type: 'function',
                      function: {
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.schema.toJsonSchema(),
                      },
                    })),
                  )
                  .toUndefined(),
              },
              signal: signal.toUndefined(),
              responseType: 'stream',
              onRequestError() {
                if (
                  signal.isSomeAnd((signal) => signal.aborted) &&
                  onAbort.isSome()
                ) {
                  onAbort.unwrap()()
                }
              },
            }),
          (e) => new Error(`Failed to fetch chat completions`, { cause: e }),
        )
        let lastToolCallId: Option<string> = Option.None()
        const localToolCalls = new Map<
          string,
          {
            function: {
              arguments: string
              name: string
            }
            id: string
            result: Option<string>
            success: boolean
          }
        >()
        for await (const [
          completion,
          abort,
        ] of processOpenAIAPIChatCompletionsStream(stream)) {
          if (signal.isSomeAnd((signal) => signal.aborted)) {
            onAbort.inspect((onAbort) => onAbort())
            return
          }
          const choice = (yield* completion).choices[0]
          if (!choice) continue
          const delta = choice.delta
          const lastChunk = chunks.at(-1)!
          if (delta.isSome()) {
            const { chunks: newChunks, lastToolCallId: newLastToolCallId } =
              handleDelta(
                lastChunk.type === 'llm' ? lastChunk.chunks : [],
                delta.unwrap(),
                localToolCalls,
                lastToolCallId,
              )
            chunks = create(chunks, (chunks) => {
              if (lastChunk.type === 'llm') {
                chunks[chunks.length - 1].chunks = newChunks
              } else {
                chunks.push({ type: 'llm', chunks: newChunks, finished: false })
              }
            })
            lastToolCallId = newLastToolCallId
            onChunk.inspect((onChunk) => onChunk(newChunks))
          }

          if (choice.finish_reason.isNone()) continue
          switch (choice.finish_reason.unwrap()) {
            case 'error': {
              yield* AsyncResult.Err(
                new Error('Error in chat completion', { cause: completion }),
              )
              break
            }
            case 'stop': {
              abort()
              break
            }
            case 'tool_calls': {
              for (const call of localToolCalls.values()) {
                if (signal.isSomeAnd((signal) => signal.aborted)) {
                  onAbort.inspect((onAbort) => onAbort())
                  return
                }
                yield* tryBlock(
                  async function* () {
                    const result = tools!
                      .andThen((tools) =>
                        Option.fromUndefined(
                          tools.find(
                            (tool) => tool.name === call.function.name,
                          ),
                        ),
                      )
                      .okOrElse(
                        () =>
                          new Error(
                            `Tool with name ${call.function.name} not found. Expected one of (${tools
                              .unwrap()
                              .map((tool) => tool.name)
                              .join(', ')})`,
                          ),
                      )
                      .andThen((tool) =>
                        safeParseJson(call.function.arguments, {
                          validate: tool.schema.assert,
                        })
                          .context('Invalid arguments for tool')
                          .map((args) => ({ tool, args })),
                      )
                      .toAsync()
                      .andThen(({ args, tool }) => {
                        return AsyncResult.fromPromise(
                          () => Promise.resolve(tool.handler(args)),
                          (e) =>
                            new Error(`Failed to execute tool`, { cause: e }),
                        )
                      })

                    await result.match(
                      (value) => (call.result = Option.Some(value)),
                      (error) =>
                        (call.result = Option.Some(formatError(error))),
                    )
                  },
                  (e) => new Error(`Failed to execute tool`, { cause: e }),
                )
              }

              const newChunks = create(chunks, (chunks) => {
                const subchunks = chunks
                  .values()
                  .filter((chunk) => chunk.type === 'llm')
                  .flatMap((chunk) => chunk.chunks)
                for (const chunk of subchunks) {
                  if (chunk.type === 'tool_call') {
                    if (chunk.finished) continue
                    chunk.success = true
                    const call = Option.fromUndefined(
                      localToolCalls.get(chunk.tool_call_id),
                    )
                    chunk.content = call
                      .andThen((call) => call.result)
                      .unwrapOr('')
                  }

                  if (chunk.type === 'reasoning' || chunk.type === 'tool_call')
                    chunk.finished = true
                }
              })

              onChunk.inspect((onChunk) =>
                onChunk(
                  (newChunks.at(-1) as TMessage & { type: 'llm' }).chunks,
                ),
              )

              yield* openAiAdapter.handleChatCompletion({
                chunks: newChunks,
                onChunk,
                fetcher,
                model,
                signal,
                tools,
                onAbort,
              })
              return
            }
          }
        }
      },
      (e) => new Error(`Failed to fetch chat completions`, { cause: e }),
    ),
  processContentDelta: (delta: TOpenAIChatCompletionResponseChunkDelta) =>
    delta.content,
  processToolCallDelta: (delta: TOpenAIChatCompletionResponseChunkDelta) =>
    delta.tool_calls.unwrapOr([]),
  processReasoningDelta: (delta: TOpenAIChatCompletionResponseChunkDelta) =>
    delta.reasoning.or(delta.reasoning_content),
} satisfies TAdapter

function handleDelta(
  chunks: TLLMMessageChunk[],
  delta: TOpenAIChatCompletionResponseChunkDelta,
  localToolCalls: Map<
    string,
    {
      function: {
        arguments: string
        name: string
      }
      id: string
      result: Option<string>
      success: boolean
    }
  >,
  lastToolCallId: Option<string>,
): { chunks: TLLMMessageChunk[]; lastToolCallId: Option<string> } {
  if (delta.tool_calls.isSome()) {
    const serverCalls = openAiAdapter.processToolCallDelta(delta)
    let newToolCallId = Option.None<string>()
    const newChunks = create(chunks, (chunks) => {
      for (const serverCall of serverCalls) {
        const didLastToolFinish = lastToolCallId.isSomeAnd((lastToolCallId) =>
          serverCall.id.isSomeAnd(
            (serverCallId) => serverCallId !== lastToolCallId,
          ),
        )
        if (didLastToolFinish) {
          const lastChunk = Option.fromUndefined(chunks.at(-1)).expect(
            'should be defined since we have a lastToolCallId set',
          )
          if (lastChunk.type === 'tool_call') lastChunk.finished = true

          if (serverCall.id.isNone()) {
            console.warn('Last tool finished but new tool is None')
            continue
          }

          const id = serverCall.id.unwrap()
          const existingToolCall = localToolCalls.get(id)!

          serverCall.function.arguments.inspect((value) => {
            existingToolCall.function.arguments += value
          })
        } else {
          newToolCallId = lastToolCallId.or(serverCall.id)
          if (newToolCallId.isNone()) {
            console.warn('No tool call id')
            continue
          }
          const id = newToolCallId.unwrap()
          const hasSeenToolBefore = localToolCalls.has(id)
          if (!hasSeenToolBefore) {
            const call = {
              id,
              function: {
                name: serverCall.function.name.unwrapOr(''),
                arguments: serverCall.function.arguments.unwrapOr(''),
              },
              success: false,
              result: Option.None<string>(),
            }
            localToolCalls.set(id, call)
            chunks.push({
              id: nanoid(),
              tool_call_id: id,
              type: 'tool_call',
              tool: {
                name: call.function.name,
                arguments: call.function.arguments,
              },
              finished: false,
              success: false,
              content: '',
            })
          } else {
            const existingChunk = chunks.at(-1)!
            if (existingChunk.type !== 'tool_call') {
              console.warn('Expected tool call chunk')
              continue
            }
            const existingToolCall = localToolCalls.get(id)!
            serverCall.function.arguments.inspect((value) => {
              existingToolCall.function.arguments += value
              existingChunk.tool.arguments = existingToolCall.function.arguments
            })
          }
        }
      }
    })
    return { chunks: newChunks, lastToolCallId: newToolCallId }
  }

  const newChunks = create(chunks, (draft) => {
    const deltaHasOpeningThinkTag = delta.content.isSomeAnd((value) =>
      value.includes('<think>'),
    )
    const deltaHasClosingThinkTag = delta.content.isSomeAnd((value) =>
      value.includes('</think>'),
    )
    const reasoning = openAiAdapter.processReasoningDelta(delta)

    const lastChunk = Option.fromUndefined(draft.at(-1))
    lastChunk.inspect((chunk) => {
      if (chunk.type !== 'reasoning') return
      chunk.finished ||= chunk.wasStartedByThinkTag
        ? deltaHasClosingThinkTag || delta.content.isNone()
        : reasoning.isNone()
    })

    const shouldReason =
      reasoning.isSome() ||
      deltaHasOpeningThinkTag ||
      lastChunk.isSomeAnd((chunk) => {
        return chunk.type === 'reasoning' && !chunk.finished
      })

    const newChunkType = shouldReason ? 'reasoning' : 'text'

    const shouldCreateNewChunk = lastChunk.isNoneOr((chunk) => {
      if (chunk.type === 'reasoning' && !chunk.finished) return false
      return chunk.type !== newChunkType
    })
    const chunkToUse: TLLMMessageChunk = shouldCreateNewChunk
      ? makeNewLLMMessageChunk(newChunkType, deltaHasOpeningThinkTag)
      : lastChunk.unwrap()

    switch (newChunkType) {
      case 'reasoning': {
        if (deltaHasClosingThinkTag) break
        const content = reasoning.or(delta.content).map((content) => {
          if (!deltaHasOpeningThinkTag) return content
          return content.slice('<think>'.length)
        })
        const shouldAppend =
          content.isSome() &&
          chunkToUse.content.trim().length + content.unwrap().trim().length > 0
        if (!shouldAppend) break
        chunkToUse.content += content.unwrap()
        if (shouldCreateNewChunk) draft.push(chunkToUse)
        break
      }
      case 'text': {
        const content = openAiAdapter
          .processContentDelta(delta)
          .map((content) => {
            if (deltaHasClosingThinkTag)
              return content.slice(
                content.indexOf('</think>') + '</think>'.length,
              )
            return content
          })
        const shouldAppend =
          content.isSome() &&
          chunkToUse.content.trim().length + content.unwrap().trim().length > 0
        if (!shouldAppend) break
        chunkToUse.content += content.unwrap()
        if (shouldCreateNewChunk) draft.push(chunkToUse)
        break
      }
    }
  })
  return { chunks: newChunks, lastToolCallId }
}

function makeNewLLMMessageChunk(
  type: 'reasoning' | 'text',
  wasStartedByThinkTag: boolean,
): TLLMMessageChunk {
  return type === 'reasoning'
    ? { id: nanoid(), type, content: '', finished: false, wasStartedByThinkTag }
    : { id: nanoid(), type, content: '' }
}

async function* processOpenAIAPIChatCompletionsStream(
  stream: ReadableStream,
): AsyncGenerator<
  [Result<TOpenAIChatCompletionResponseChunk, Error>, () => void]
> {
  const decoder = new TextDecoder()
  const reader = stream.getReader()
  const controller = new AbortController()
  let data = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (controller.signal.aborted) break
    const text = decoder.decode(value)
    const chunkFinished = text.lastIndexOf('\n\n')
    if (chunkFinished === -1) {
      data += text
      continue
    }
    const chunk = data + text.slice(0, chunkFinished)
    data = text.slice(chunkFinished + 2)

    const events = parseSSEEventChunk(chunk)
      .map((value) => value.map((v) => v.data))
      .unwrapOr([])
    for (const event of events) {
      if (event === '[DONE]') {
        controller.abort()
        break
      }

      const completion = safeParseJson(event, {
        validate: openaiChatCompletionResponseChunkSchema.assert,
      }).inspectErr((e) => {
        if (e instanceof ParseError) {
          console.log('[Completion Error]', e.value)
        } else if (e instanceof ValidationError) {
          console.log('[Completion Error]', e.cause)
        }
      })
      yield [completion, () => controller.abort()]
    }
  }
  await reader.cancel()
}

function transformMessageChunksToRequestMessages(
  chunks: TMessage[],
  config: { includeReasoning?: boolean } = { includeReasoning: false },
) {
  const messages = [] as TOpenAIChatCompletionRequest['messages']
  for (const chunk of chunks) {
    if (chunk.type === 'llm') {
      for (const subchunk of chunk.chunks) {
        if (subchunk.type === 'reasoning') {
          if (!config.includeReasoning) continue
          messages.push({
            role: 'assistant',
            content: subchunk.content,
          })
        } else if (subchunk.type === 'text') {
          messages.push({
            role: 'assistant',
            content: subchunk.content,
          })
        } else if (subchunk.type === 'tool_call') {
          messages.push(
            {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: subchunk.tool_call_id,
                  type: 'function',
                  function: {
                    name: subchunk.tool.name,
                    arguments: subchunk.tool.arguments,
                  },
                },
              ],
            },
            {
              role: 'tool',
              name: subchunk.tool.name,
              content: subchunk.content,
              tool_call_id: subchunk.tool_call_id,
            },
          )
        }
      }
    } else if (chunk.type === 'user') {
      for (const subchunk of chunk.chunks) {
        messages.push({
          role: 'user',
          content: subchunk.content,
        })
      }
    }
  }
  return messages
}

export { openAiAdapter }
