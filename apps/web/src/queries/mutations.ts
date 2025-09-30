import { match, type } from 'arktype'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Transaction } from 'sqlocal'

import { db, beginTransaction } from '~/db/client'
import * as schema from '~/db/schema'

const validMessage = type({
  user_intent: '"add_provider"',
  meta: {
    'id?': 'string',
    name: 'string',
    type: '"openai"',
    baseUrl: 'string.url',
    token: 'string',
    defaultModelIds: 'string[]',
  },
})
  .or({
    user_intent: '"add_mcp"',
    meta: {
      'id?': 'string',
      name: 'string',
      url: 'string.url',
    },
  })
  .or({
    user_intent: '"delete_mcp"',
    meta: {
      id: 'string',
    },
  })
  .or({
    user_intent: '"set_user_metadata"',
    meta: {
      id: 'string',
      value: 'string',
    },
  })
  .or({
    user_intent: '"delete_provider"',
    meta: {
      id: 'string',
    },
  })
  .or({
    user_intent: '"update_provider"',
    meta: {
      id: 'string',
      name: 'string',
      type: '"openai"',
      baseUrl: 'string.url',
      token: 'string',
      defaultModelIds: 'string[]',
    },
  })
  .or({
    user_intent: '"update_mcp"',
    meta: {
      id: 'string',
      name: 'string',
      url: 'string.url',
    },
  })
  .or({
    user_intent: '"create_chat"',
    meta: {
      'id?': 'string',
      title: 'string',
      messages: 'object',
    },
  })
  .or({
    user_intent: '"update_chat"',
    meta: {
      id: 'string',
      title: 'string',
      messages: 'object',
    },
  })
  .or({
    user_intent: '"delete_chat"',
    meta: {
      id: 'string',
    },
  })

type TValidMessage = typeof validMessage.infer

const processMessage = async (
  value: TValidMessage,
  opts: { tx?: Transaction } = {},
) => {
  const tx = opts.tx ?? (await beginTransaction())
  const updates = match
    .in<TValidMessage>()
    .at('user_intent')
    .match({
      "'add_provider'": ({
        meta: { id, name, type, baseUrl, token, defaultModelIds },
      }) => {
        return [
          {
            operation: 'insert',
            table: schema.providers,
            id: id ?? nanoid(),
            data: {
              name,
              type,
              baseUrl,
              token,
              defaultModelIds,
            },
          },
        ]
      },
      "'add_mcp'": ({ meta: { id, name, url } }) => {
        return [
          {
            operation: 'insert',
            table: schema.mcps,
            id: id ?? nanoid(),
            data: {
              name,
              url,
            },
          },
        ]
      },
      "'delete_mcp'": async ({ meta: { id } }) => {
        const existingMcp = await tx
          .query(
            db
              .select({ id: schema.mcps.id })
              .from(schema.mcps)
              .where(eq(schema.mcps.id, id)),
          )
          .then((rows) => rows[0])
        if (!existingMcp) return []

        return [
          {
            operation: 'update',
            table: schema.mcps,
            id,
            data: { deleted: true },
          },
        ]
      },
      "'delete_provider'": async ({ meta: { id } }) => {
        const existingProvider = await tx
          .query(
            db
              .select({ id: schema.providers.id })
              .from(schema.providers)
              .where(eq(schema.providers.id, id)),
          )
          .then((rows) => rows[0])
        if (!existingProvider) return []

        return [
          {
            operation: 'update',
            table: schema.providers,
            id,
            data: { deleted: true },
          },
        ]
      },
      "'update_provider'": async ({
        meta: { id, name, type, baseUrl, token, defaultModelIds },
      }) => {
        const existingProvider = await tx
          .query(
            db
              .select({ id: schema.providers.id })
              .from(schema.providers)
              .where(eq(schema.providers.id, id)),
          )
          .then((rows) => rows[0])
        if (!existingProvider) return []

        return [
          {
            operation: 'update',
            table: schema.providers,
            id,
            data: {
              name,
              type,
              baseUrl,
              token,
              defaultModelIds,
            },
          },
        ]
      },
      "'update_mcp'": async ({ meta: { id, name, url } }) => {
        const existingMcp = await tx
          .query(
            db
              .select({ id: schema.mcps.id })
              .from(schema.mcps)
              .where(eq(schema.mcps.id, id)),
          )
          .then((rows) => rows[0])
        if (!existingMcp) return []

        return [
          {
            operation: 'update',
            table: schema.mcps,
            id,
            data: {
              name,
              url,
            },
          },
        ]
      },
      "'set_user_metadata'": async ({ meta: { id, value } }) => {
        const existingMetadata = await tx.query(
          db
            .select()
            .from(schema.userMetadata)
            .where(eq(schema.userMetadata.id, id)),
        )

        return [
          {
            operation: existingMetadata.length > 0 ? 'update' : 'insert',
            table: schema.userMetadata,
            id,
            data: { value },
          },
        ]
      },
      "'create_chat'": async ({ meta: { id, title, messages } }) => {
        const existingChat = id
          ? await tx
              .query(
                db
                  .select({ id: schema.chats.id })
                  .from(schema.chats)
                  .where(eq(schema.chats.id, id)),
              )
              .then((rows) => rows[0])
          : null

        if (existingChat) return []

        return [
          {
            operation: 'insert',
            table: schema.chats,
            id: id ?? nanoid(),
            data: { title, messages },
          },
        ]
      },
      "'update_chat'": async ({ meta: { id, title, messages } }) => {
        const existingChat = await tx
          .query(
            db
              .select({ id: schema.chats.id })
              .from(schema.chats)
              .where(eq(schema.chats.id, id)),
          )
          .then((rows) => rows[0])
        if (!existingChat) return []

        return [
          {
            operation: 'update',
            table: schema.chats,
            id,
            data: { title, messages },
          },
        ]
      },
      "'delete_chat'": async ({ meta: { id } }) => {
        const existingChat = await tx
          .query(
            db
              .select({ id: schema.chats.id })
              .from(schema.chats)
              .where(eq(schema.chats.id, id)),
          )
          .then((rows) => rows[0])
        if (!existingChat) return []

        return [
          {
            operation: 'update',
            table: schema.chats,
            id,
            data: { deleted: true },
          },
        ]
      },
      default: 'assert',
    })(value)

  if (!opts.tx) await tx.commit()
  return updates
}

export { processMessage, validMessage }
export type { TValidMessage }
