import { nanoid } from 'nanoid';
import { AsyncResult, Option } from 'ts-result-option';
import { safeParseJson, tryBlock } from 'ts-result-option/utils';

import type { TAdapter } from '~/lib/adapters/types';
import type { TLLMMessageChunk, TMessage } from '~/types/chat';

import { type TTool } from '~/types';
import { ajv } from '~/utils/ajv';
import { formatError } from '~/utils/errors';
import { produce } from '~/utils/immer';

export function handleCompletion(opts: {
  adapter: TAdapter;
  messages: TMessage[];
  model: string;
  onAbort?: () => void;
  onChunk?: (chunks: TLLMMessageChunk[]) => void;
  reasoningEffort?: 'high' | 'low' | 'medium' | 'minimal' | 'none' | 'xhigh';
  signal?: AbortSignal;
  system?: string;
  tools?: TTool[];
}): AsyncResult<void, Error> {
  return tryBlock(
    async function* () {
      const {
        onAbort,
        adapter,
        reasoningEffort = 'medium',
        signal,
        model,
        onChunk,
        system,
        tools
      } = opts;
      let messages = structuredClone(opts.messages);

      const producedChunks = [] as TLLMMessageChunk[];
      const executedToolCalls = new Set<string>();

      const controller = new AbortController();
      if (signal) signal.addEventListener('abort', () => controller.abort());
      if (onAbort) controller.signal.addEventListener('abort', onAbort);
      while (!controller.signal.aborted) {
        const generator = adapter.generateCompletion({
          messages,
          model,
          reasoningEffort,
          signal: controller.signal,
          system,
          tools
        });
        let result = await generator.next();

        while (!result.done) {
          const { content, reasoning, tools } = result.value;

          const lastChunk = Option.from(producedChunks.at(-1));
          const lastChunkType = lastChunk.map((lastChunk) => lastChunk.type);

          if (reasoning.isSome()) {
            if (lastChunkType.isNoneOr((lastChunkType) => lastChunkType !== 'reasoning')) {
              const newChunk: TLLMMessageChunk = {
                type: 'reasoning',
                content: reasoning.unwrap(),
                id: nanoid()
              };
              producedChunks.push(newChunk);
            } else {
              lastChunk.inspect((lastChunk) => (lastChunk.content += reasoning.unwrap()));
            }
          }
          if (tools.isSome()) {
            const tools_ = tools.unwrap();
            for (const tool of tools_) {
              const { id, name, arguments: args } = tool;
              const chunk = Option.from(
                producedChunks.find((chunk) => chunk.type === 'tool_call' && chunk.id === id)
              );
              if (chunk.isNone()) {
                const newChunk: TLLMMessageChunk = {
                  type: 'tool_call',
                  success: null,
                  content: '',
                  tool: {
                    name: name.unwrap(),
                    arguments: args.unwrap()
                  },
                  id
                };
                producedChunks.push(newChunk);
              } else {
                chunk.inspect((chunk) => {
                  if (name.isSome())
                    (chunk as TLLMMessageChunk & { type: 'tool_call' }).tool.name += name.unwrap();
                  if (args.isSome())
                    (chunk as TLLMMessageChunk & { type: 'tool_call' }).tool.arguments +=
                      args.unwrap();
                });
              }
            }
          }
          if (content.isSome()) {
            if (lastChunkType.isNoneOr((lastChunkType) => lastChunkType !== 'text')) {
              const newChunk: TLLMMessageChunk = {
                type: 'text',
                content: content.unwrap(),
                id: nanoid()
              };
              producedChunks.push(newChunk);
            } else {
              lastChunk.inspect((lastChunk) => (lastChunk.content += content.unwrap()));
            }
          }
          onChunk?.(producedChunks);
          result = await generator.next();
        }

        switch (result.value.finish_reason) {
          case 'error': {
            if (result.value.error instanceof Error) throw result.value.error;
            throw new Error('Completion Error', { cause: result.value.error });
          }
          case 'stop': {
            controller.abort();
            break;
          }
          case 'tool_calls': {
            if (!tools) throw new Error('No tools provided but tool calls were requested');
            const tool_calls = producedChunks.filter(
              (chunk): chunk is TLLMMessageChunk & { type: 'tool_call' } =>
                chunk.type === 'tool_call' && !executedToolCalls.has(chunk.id)
            );
            yield* executeToolCalls(tool_calls, tools, controller.signal, () =>
              onChunk?.(producedChunks)
            );
            for (const tool_call of tool_calls) {
              executedToolCalls.add(tool_call.id);
            }
            messages = produce(messages, (messages) => {
              const message = Option.from(messages.at(-1) as TMessage & { type: 'llm' }).expect(
                'Expected at least one message'
              );
              message.chunks = producedChunks;
            });
          }
        }
      }

      return AsyncResult.Ok();
    },
    (e) => new Error('Error while generating completion', { cause: e })
  );
}

// NOTE: cannot do parallel tool calls, since most mcp servers currently have
// bugs in them that stall all requests other than the first when making parallel request
function executeToolCalls(
  tool_calls: Array<TLLMMessageChunk & { type: 'tool_call' }>,
  tools: TTool[],
  signal: AbortSignal,
  onUpdate: () => void
) {
  return AsyncResult.from(
    async () => {
      for (const tool_call of tool_calls) {
        if (signal?.aborted) throw new Error('Aborted');
        await Option.fromUndefined(tools.find((tool) => tool.name === tool_call.tool.name))
          .okOrElse(
            () =>
              new Error(
                `Tool with name ${tool_call.tool.name} not found. Expected one of (${tools.map((tool) => tool.name).join(', ')})`
              )
          )
          .andThen((tool) => {
            if (signal?.aborted) throw new Error('Aborted');
            return safeParseJson(tool_call.tool.arguments, {
              validate: (args) => {
                const valid = ajv.validate(tool.jsonSchema, args);
                if (!valid)
                  throw new Error(
                    JSON.stringify({
                      success: false,
                      code: 'INVALID_ARGUMENTS',
                      error: ajv.errors
                    })
                  );
                return args;
              }
            }).map((args) => ({ tool, args }));
          })
          .toAsync()
          .andThen(({ args, tool }) => {
            if (signal?.aborted) throw new Error('Aborted');
            return AsyncResult.from(
              () => Promise.try(tool.handler, args),
              (e) => new Error(`Failed to execute tool`, { cause: e })
            ).inspectErr(console.log);
          })
          .match(
            (value) => {
              tool_call.content = value;
              tool_call.success = true;
            },
            (error) => {
              tool_call.content = formatError(error);
              tool_call.success = false;
            }
          )
          .finally(() => onUpdate());
      }
    },
    (e) => new Error('Error while executing tool calls', { cause: e })
  );
}
