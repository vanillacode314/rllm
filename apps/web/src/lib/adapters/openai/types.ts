import * as z from 'zod/mini';

import { asOption } from '~/utils/zod';

const openaiModelSchema = z.object({
  id: z.string(),
  name: z.optional(z.string())
});
type TOpenAIModel = z.infer<typeof openaiModelSchema>;
const openaiChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.discriminatedUnion('role', [
    z.object({
      role: z.literal('system'),
      content: z.string()
    }),
    z.object({
      role: z.literal('user'),
      content: z.union([
        z.string(),
        z.array(
          z.union([
            z.object({
              type: z.literal('text'),
              text: z.string()
            }),
            z.object({
              type: z.literal('image_url'),
              image_url: z.object({
                url: z.url()
              })
            })
          ])
        )
      ])
    }),
    z.object({
      role: z.literal('assistant'),
      content: z.string(),
      tool_calls: z.optional(
        z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            function: z.object({
              name: z.string(),
              arguments: z.string()
            })
          })
        )
      )
    }),
    z.object({
      role: z.literal('tool'),
      content: z.string(),
      name: z.string(),
      tool_call_id: z.string()
    })
  ]),
  stream: z.boolean(),
  tools: z.array(
    z.object({
      type: z.literal('function'),
      function: z.object({
        name: z.string(),
        description: z.string(),
        parameters: z.looseObject({})
      })
    })
  )
});
type TOpenAIChatCompletionRequest = z.infer<typeof openaiChatCompletionRequestSchema>;

const openaiToolCallResponseSchema = z.object({
  id: asOption(z.string()),
  function: asOption(
    z.object({
      name: asOption(z.string()),
      arguments: asOption(z.string())
    })
  )
});
type TOpenAIToolCallResponse = z.infer<typeof openaiToolCallResponseSchema>;

const openaiChatCompletionResponseChunkDeltaSchema = z.object({
  role: asOption(z.string()),
  content: asOption(z.string()),
  reasoning: asOption(z.string()),
  reasoning_content: asOption(z.string()),
  tool_calls: asOption(z.array(openaiToolCallResponseSchema))
});
type TOpenAIChatCompletionResponseChunkDelta = z.infer<
  typeof openaiChatCompletionResponseChunkDeltaSchema
>;

const openaiChatCompletionResponseChunkSchema = z.object({
  choices: asOption(
    z.array(
      z.object({
        finish_reason: asOption(
          z.union([z.literal('stop'), z.literal('tool_calls'), z.literal('error')])
        ),
        delta: asOption(openaiChatCompletionResponseChunkDeltaSchema)
      })
    )
  ),
  error: asOption(
    z.object({
      message: z.string(),
      code: z.number()
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
