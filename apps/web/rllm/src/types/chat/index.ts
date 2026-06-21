import * as z from 'zod/mini';

import { chatSettingsSchema } from '~/lib/chat/settings';
import { ReactiveTree, Tree } from '~/utils/tree';

export const llmMessageChunkSchema = z.discriminatedUnion('type', [
  z.object({
    content: z.string(),
    id: z.string(),
    type: z.literal('text')
  }),
  z.object({
    content: z.string(),
    id: z.string(),
    type: z.literal('reasoning')
  }),
  z.object({
    content: z.string(),
    id: z.string(),
    success: z.nullable(z.boolean()),
    tool: z.object({
      arguments: z.string(),
      name: z.string()
    }),
    type: z.literal('tool_call')
  })
]);
export type TLLMMessageChunk = z.infer<typeof llmMessageChunkSchema>;

const userMessageChunkSchema = z.discriminatedUnion('type', [
  z.object({
    content: z.string(),
    id: z.string(),
    type: z.literal('text')
  }),
  z.object({
    content: z.string(),
    id: z.string(),
    type: z.literal('user_tool_call')
  }),
  z.object({
    filename: z.string().check(z.minLength(1)),
    id: z.string(),
    mimeType: z.string().check(z.minLength(1)),
    type: z.literal('image_url'),
    url: z.url()
  })
]);
export type TUserMessageChunk = z.infer<typeof userMessageChunkSchema>;

export const messageSchema = z.discriminatedUnion('type', [
  z.object({
    chunks: z.array(llmMessageChunkSchema),
    error: z.optional(z.string()),
    finished: z.boolean(),
    model: z.string(),
    provider: z.string(),
    type: z.literal('llm'),
    usage: z.optional(
      z.object({
        cached_tokens: z.optional(z.number()),
        completion_tokens: z.optional(z.number()),
        prompt_tokens: z.optional(z.number()),
        reasoning_tokens: z.optional(z.number())
      })
    )
  }),
  z.object({
    chunks: z.array(userMessageChunkSchema),
    type: z.literal('user')
  })
]);
export type TMessage = z.infer<typeof messageSchema>;

export const chatSchema = z.object({
  finished: z.boolean(),
  id: z.string(),
  messages: z.union([z.instanceof(Tree<TMessage>), z.instanceof(ReactiveTree<TMessage>)]),
  settings: chatSettingsSchema,
  tags: z.array(z.string()),
  title: z.string()
});
export type TChat = z.infer<typeof chatSchema>;

export const attachmentsSchema = z.object({
  description: z.string(),
  documents: z.array(
    z.object({
      content: z.string(),
      embeddings: z.array(z.number()),
      index: z.number().check(z.int(), z.gt(0)),
      progress: z.number().check(z.minimum(0), z.maximum(1))
    })
  ),
  id: z.string()
});
export type TAttachment = z.infer<typeof attachmentsSchema>;
