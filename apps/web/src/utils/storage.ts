import { db, transaction } from '~/db/client'
import * as schema from '~/db/schema'
import { type TValidMessage } from '~/queries/mutations'
import { asc, inArray, sql } from 'drizzle-orm'
import type { TMessage } from '~/db/schema'

type TOptimizationState = {
  deletedChatIds: Set<string>
  deletedProviderIds: Set<string>
  deletedMCPIds: Set<string>
  alreadyUpdatedChatIds: Set<string>
  alreadyUpdatedProviderIds: Set<string>
  alreadyUpdatedMCPIds: Set<string>
  alreadySetUserMetadataKeys: Set<string>
  messagesToDelete: Set<string>
}
async function produceMessagesOptimizationState(
  messages: TMessage[],
): Promise<TOptimizationState> {
  const state = {
    deletedChatIds: new Set<string>(),
    deletedProviderIds: new Set<string>(),
    deletedMCPIds: new Set<string>(),
    alreadyUpdatedChatIds: new Set<string>(),
    alreadyUpdatedProviderIds: new Set<string>(),
    alreadyUpdatedMCPIds: new Set<string>(),
    alreadySetUserMetadataKeys: new Set<string>(),
    messagesToDelete: new Set<string>(),
  }
  for (let i = messages.length; i > 0; i--) {
    let message = messages[i - 1]
    switch (message.user_intent) {
      case 'delete_chat': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const chatId = typeSafeMessage.meta.id
        state.deletedChatIds.add(chatId)
        break
      }
      case 'delete_provider': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const providerId = typeSafeMessage.meta.id
        state.deletedProviderIds.add(providerId)
        break
      }
      case 'delete_mcp': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const mcpId = typeSafeMessage.meta.id
        state.deletedMCPIds.add(mcpId)
        break
      }
      case 'set_user_metadata': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const key = typeSafeMessage.meta.id
        if (state.alreadySetUserMetadataKeys.has(key)) {
          state.messagesToDelete.add(key)
          break
        }
        state.alreadySetUserMetadataKeys.add(key)
        break
      }
      case 'create_chat': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const chatId = typeSafeMessage.meta.id
        if (state.deletedChatIds.has(chatId as never)) {
          state.messagesToDelete.add(message.timestamp)
        }
        break
      }
      case 'add_provider': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const providerId = typeSafeMessage.meta.id
        if (state.deletedProviderIds.has(providerId as never)) {
          state.messagesToDelete.add(message.timestamp)
        }
        break
      }
      case 'add_mcp': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const mcpId = typeSafeMessage.meta.id
        if (state.deletedMCPIds.has(mcpId as never)) {
          state.messagesToDelete.add(message.timestamp)
        }
        break
      }
      case 'update_chat': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const chatId = typeSafeMessage.meta.id
        if (
          state.deletedChatIds.has(chatId as never) ||
          state.alreadyUpdatedChatIds.has(chatId as never)
        ) {
          state.messagesToDelete.add(message.timestamp)
          break
        }
        state.alreadyUpdatedChatIds.add(chatId)
        break
      }
      case 'update_provider': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const providerId = typeSafeMessage.meta.id
        if (
          state.deletedProviderIds.has(providerId as never) ||
          state.alreadyUpdatedProviderIds.has(providerId as never)
        ) {
          state.messagesToDelete.add(message.timestamp)
          break
        }
        state.alreadyUpdatedProviderIds.add(providerId)
        break
      }
      case 'update_mcp': {
        const typeSafeMessage = message as unknown as TValidMessage & {
          user_intent: typeof message.user_intent
        }
        const mcpId = typeSafeMessage.meta.id
        if (
          state.deletedMCPIds.has(mcpId as never) ||
          state.alreadyUpdatedMCPIds.has(mcpId as never)
        ) {
          state.messagesToDelete.add(message.timestamp)
          break
        }
        state.alreadyUpdatedMCPIds.add(mcpId)
        break
      }
      default: {
        break
      }
    }
  }
  return state
}

async function optimizeMessages<T extends TMessage>(
  messages: T[],
): Promise<T[]> {
  const state = await produceMessagesOptimizationState(messages)
  return messages.filter(
    (message) => !state.messagesToDelete.has(message.timestamp),
  )
}
async function optimizeStorage() {
  const messages = await db
    .select()
    .from(schema.messages)
    .orderBy(asc(schema.messages.timestamp))

  const state = await produceMessagesOptimizationState(messages)

  await transaction(async (tx) => {
    await tx.query(
      db
        .delete(schema.messages)
        .where(
          inArray(
            schema.messages.timestamp,
            state.messagesToDelete.values().toArray(),
          ),
        ),
    )
    await tx.query(
      db
        .delete(schema.chats)
        .where(
          inArray(schema.chats.id, state.deletedChatIds.values().toArray()),
        ),
    )
    await tx.query(
      db
        .delete(schema.providers)
        .where(
          inArray(
            schema.providers.id,
            state.deletedProviderIds.values().toArray(),
          ),
        ),
    )
    await tx.query(
      db
        .delete(schema.mcps)
        .where(inArray(schema.mcps.id, state.deletedMCPIds.values().toArray())),
    )
  })
  await db.run(sql`VACUUM;`)
}

export { optimizeStorage, produceMessagesOptimizationState, optimizeMessages }
