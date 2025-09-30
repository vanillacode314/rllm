import { type } from 'arktype'
import { createSelectSchema } from 'drizzle-arktype'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'
import type { TValidMessage } from '~/queries/mutations'

import type { TMessage as TChatMessage } from '~/types/chat'
import type { JsonTree } from '~/utils/tree'

const sqliteBool = type('boolean').or(type('number').pipe((v) => v === 1))

const timestamp = () => text().notNull()
const updatedAt = () =>
  text({ mode: 'json' }).notNull().$type<Record<string, string>>()

const userMetadata = sqliteTable('userMetadata', {
  createdAt: timestamp(),
  id: text()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  value: text().notNull(),
  updatedAt: updatedAt(),
})
const metadata = sqliteTable('metadata', {
  key: text()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  value: text().notNull(),
})

const providers = sqliteTable('providers', {
  createdAt: timestamp(),
  id: text().primaryKey().$defaultFn(nanoid),
  name: text().notNull(),
  type: text().notNull().$type<'openai'>(),
  baseUrl: text().notNull(),
  token: text().notNull(),
  defaultModelIds: text({ mode: 'json' }).notNull().$type<string[]>(),
  updatedAt: updatedAt(),
  deleted: integer({ mode: 'boolean' }).notNull().default(false),
})

const chats = sqliteTable('chats', {
  createdAt: timestamp(),
  id: text().primaryKey().$defaultFn(nanoid),
  title: text().notNull(),
  messages: text({ mode: 'json' }).notNull().$type<JsonTree<TChatMessage>>(),
  updatedAt: updatedAt(),
  deleted: integer({ mode: 'boolean' }).notNull().default(false),
})

const mcps = sqliteTable('mcps', {
  createdAt: timestamp(),
  id: text().primaryKey().$defaultFn(nanoid),
  name: text().notNull(),
  url: text().notNull(),
  updatedAt: updatedAt(),
  deleted: integer({ mode: 'boolean' }).notNull().default(false),
})
const messages = sqliteTable('messages', {
  timestamp: timestamp().primaryKey(),
  user_intent: text().notNull().$type<TValidMessage['user_intent']>(),
  meta: text({ mode: 'json' }).notNull().$type<Record<string, unknown>>(),
})

const metadataSchema = createSelectSchema(metadata)
const providersSchema = createSelectSchema(providers, {
  baseUrl: 'string.url',
  updatedAt: [
    ['string.json.parse', '|>', 'Record<string, string>'],
    '|',
    'Record<string, string>',
  ],
  deleted: sqliteBool,
})
const messagesSchema = createSelectSchema(messages)
const userMetadataSchema = createSelectSchema(userMetadata)
const chatsSchema = createSelectSchema(chats)
const mcpsSchema = createSelectSchema(mcps)

type TChat = typeof chats.$inferSelect
type TMessage = typeof messages.$inferSelect
type TMetadata = typeof metadata.$inferSelect
type TProvider = typeof providers.$inferSelect
type TUserMetadata = typeof userMetadata.$inferSelect
type TMCP = typeof mcps.$inferSelect

export {
  chats,
  chatsSchema,
  messages,
  messagesSchema,
  metadata,
  metadataSchema,
  providers,
  providersSchema,
  userMetadata,
  userMetadataSchema,
  mcps,
  mcpsSchema,
}
export type { TChat, TMessage, TMetadata, TProvider, TUserMetadata, TMCP }
