import * as z from 'zod/mini';

import { chatSettingsSchema } from '~/lib/chat/settings';
import { Tree } from '~/utils/tree';

export const llmMessageChunkSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('text'),
    content: z.string()
  }),
  z.object({
    id: z.string(),
    type: z.literal('reasoning'),
    content: z.string()
  }),
  z.object({
    id: z.string(),
    type: z.literal('tool_call'),
    content: z.string(),
    tool: z.object({
      name: z.string(),
      arguments: z.string()
    }),
    success: z.boolean()
  })
]);
export type TLLMMessageChunk = z.infer<typeof llmMessageChunkSchema>;

const userMessageChunkSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    type: z.literal('text'),
    content: z.string()
  }),
  z.object({
    id: z.string(),
    type: z.literal('user_tool_call'),
    content: z.string()
  }),
  z.object({
    id: z.string(),
    type: z.literal('image_url'),
    url: z.url(),
    filename: z.string().check(z.minLength(1)),
    mimeType: z.string().check(z.minLength(1))
  })
]);
export type TUserMessageChunk = z.infer<typeof userMessageChunkSchema>;

export const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('llm'),
    model: z.string(),
    provider: z.string(),
    finished: z.boolean(),
    error: z.optional(z.string()),
    chunks: z.array(llmMessageChunkSchema)
  }),
  z.object({
    type: z.literal('user'),
    chunks: z.array(userMessageChunkSchema)
  })
]);
export type TMessage = z.infer<typeof messageSchema>;

export const chatSchema = z.object({
  id: z.string(),
  title: z.string(),
  finished: z.boolean(),
  tags: z.array(z.string()),
  settings: chatSettingsSchema,
  messages: z.instanceof(Tree<TMessage>)
});
export type TChat = z.infer<typeof chatSchema>;

export const attachmentsSchema = z.object({
  id: z.string(),
  description: z.string(),
  documents: z.array(
    z.object({
      content: z.string(),
      embeddings: z.array(z.number()),
      index: z.number().check(z.int(), z.gt(0)),
      progress: z.number().check(z.minimum(0), z.maximum(1))
    })
  )
});
export type TAttachment = z.infer<typeof attachmentsSchema>;
