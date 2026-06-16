import * as z from 'zod/mini';

import { asOption } from '~/utils/zod';

const openaiModelSchema = z.object({
  id: z.string(),
  name: z.optional(z.string())
});
type TOpenAIModel = z.infer<typeof openaiModelSchema>;
const openaiChatCompletionRequestSchema = z.object({
  messages: z.discriminatedUnion('role', [
    z.object({
      content: z.string(),
      role: z.literal('system')
    }),
    z.object({
      content: z.array(
        z.union([
          z.object({
            text: z.string(),
            type: z.literal('text')
          }),
          z.object({
            image_url: z.object({
              url: z.url()
            }),
            type: z.literal('image_url')
          })
        ])
      ),
      role: z.literal('user')
    }),
    z.object({
      content: z.string(),
      reasoning_content: z.optional(z.string()),
      role: z.literal('assistant'),
      tool_calls: z.optional(
        z.array(
          z.object({
            function: z.object({
              arguments: z.string(),
              name: z.string()
            }),
            id: z.string(),
            type: z.string()
          })
        )
      )
    }),
    z.object({
      content: z.string(),
      name: z.string(),
      role: z.literal('tool'),
      tool_call_id: z.string()
    })
  ]),
  model: z.string(),
  stream: z.boolean(),
  tools: z.array(
    z.object({
      function: z.object({
        description: z.string(),
        name: z.string(),
        parameters: z.looseObject({})
      }),
      type: z.literal('function')
    })
  )
});
type TOpenAIChatCompletionRequest = z.infer<typeof openaiChatCompletionRequestSchema>;

const openaiToolCallResponseSchema = z.object({
  function: asOption(
    z.object({
      arguments: asOption(z.string()),
      name: asOption(z.string())
    })
  ),
  id: asOption(z.string())
});
type TOpenAIToolCallResponse = z.infer<typeof openaiToolCallResponseSchema>;

const openaiChatCompletionResponseChunkDeltaSchema = z.object({
  content: asOption(z.string()),
  reasoning: asOption(z.string()),
  reasoning_content: asOption(z.string()),
  role: asOption(z.string()),
  tool_calls: asOption(z.array(openaiToolCallResponseSchema))
});
type TOpenAIChatCompletionResponseChunkDelta = z.infer<
  typeof openaiChatCompletionResponseChunkDeltaSchema
>;

const openaiChatCompletionResponseChunkSchema = z.object({
  choices: asOption(
    z.array(
      z.object({
        delta: asOption(openaiChatCompletionResponseChunkDeltaSchema),
        finish_reason: asOption(
          z.union([z.literal('stop'), z.literal('tool_calls'), z.literal('error')])
        )
      })
    )
  ),
  error: asOption(
    z.object({
      code: z.number(),
      message: z.string()
    })
  )
});
type TOpenAIChatCompletionResponseChunk = z.infer<typeof openaiChatCompletionResponseChunkSchema>;

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
