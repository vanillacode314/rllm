import { type } from 'arktype'

import { Tree, TTree } from '~/utils/tree'

const llmMessageChunkSchema = type({
  id: 'string',
  type: "'text'",
  content: 'string',
})
  .or({
    id: 'string',
    type: "'reasoning'",
    content: 'string',
    finished: 'boolean',
    wasStartedByThinkTag: 'boolean',
  })
  .or({
    id: 'string',
    tool_call_id: 'string',
    type: "'tool_call'",
    content: 'string',
    tool: {
      name: 'string',
      arguments: 'string',
    },
    finished: 'boolean',
    success: 'boolean',
  })
type TLLMMessageChunk = typeof llmMessageChunkSchema.infer

const userMessageChunkSchema = type({
  id: 'string',
  type: "'text'",
  content: 'string',
}).or({
  id: 'string',
  type: "'user_tool_call'",
  content: 'string',
})
type TUserMessageChunk = typeof userMessageChunkSchema.infer

const messageSchema = type({
  type: "'llm'",
  // llm: {
  //   model: "string",
  //   provider: "string"
  // },
  finished: 'boolean',
  chunks: llmMessageChunkSchema.array(),
}).or({
  type: "'user'",
  chunks: userMessageChunkSchema.array(),
})
type TMessage = typeof messageSchema.infer

const chatSchema = type({
  id: 'string',
  title: 'string',
  messages: type.instanceOf(Tree).as<TTree<TMessage>>(),
})
type TChat = typeof chatSchema.infer

export {
  chatSchema,
  llmMessageChunkSchema,
  messageSchema,
  userMessageChunkSchema,
}
export type { TChat, TLLMMessageChunk, TMessage, TUserMessageChunk }
