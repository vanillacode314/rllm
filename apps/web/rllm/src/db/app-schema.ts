import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';
import * as z from 'zod';

import type { TChatSettings } from '~/lib/chat/settings';
import type { TChat as TChatChat, TMessage as TChatMessage } from '~/types/chat';
import type { JsonTree } from '~/utils/tree';

const timestamp = () => text().notNull();

const userMetadata = sqliteTable('userMetadata', {
  createdAt: timestamp(),
  id: text().primaryKey().notNull(),
  value: text().notNull()
});
const chatPresets = sqliteTable('chatPresets', {
  createdAt: timestamp(),
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  settings: text({ mode: 'json' }).notNull().$type<TChatSettings>()
});
const providers = sqliteTable('providers', {
  baseUrl: text().notNull(),
  createdAt: timestamp(),
  defaultModelIds: text({ mode: 'json' }).notNull().$type<string[]>(),
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  token: text().notNull(),
  type: text().notNull().$type<'openai'>()
});
const chats = sqliteTable('chats', {
  accessCount: integer().notNull().default(0),
  createdAt: timestamp(),
  finished: integer({ mode: 'boolean' })
    .notNull()
    .default(sql`1`),
  id: text().primaryKey().notNull(),
  lastAccessedAt: integer(),
  messages: text({ mode: 'json' }).notNull().$type<JsonTree<TChatMessage>>(),
  settings: text({ mode: 'json' }).notNull().$type<TChatChat['settings']>(),
  tags: text({ mode: 'json' })
    .notNull()
    .$type<string[]>()
    .default(sql`"[]"`),
  title: text().notNull()
});
const mcps = sqliteTable('mcps', {
  createdAt: timestamp(),
  id: text().primaryKey().notNull(),
  name: text().notNull(),
  url: text().notNull()
});
const documents = sqliteTable('documents', {
  createdAt: timestamp(),
  id: text().primaryKey().notNull(),
  name: text().notNull()
});
export const tables = { chatPresets, chats, documents, mcps, providers, userMetadata };

export const providersSchema = createSelectSchema(providers, {
  baseUrl: z.url(),
  defaultModelIds: z.array(z.string().check(z.minLength(1))).check(z.minLength(1))
});
export const userMetadataSchema = createSelectSchema(userMetadata);
export const chatsSchema = createSelectSchema(chats, {
  tags: z.array(z.string().check(z.minLength(1)))
  // settings: chatSchema.get('settings')
  // messages: JsonTreeSchema(messageSchema)
});
export const mcpsSchema = createSelectSchema(mcps);
export const chatPresetsSchema = createSelectSchema(chatPresets);
export const documentsSchema = createSelectSchema(documents);

export type TChat = typeof chats.$inferSelect;
export type TChatPreset = typeof chatPresets.$inferSelect;
export type TDocument = typeof documents.$inferSelect;
export type TMCP = typeof mcps.$inferSelect;
export type TProvider = typeof providers.$inferSelect;
export type TUserMetadata = typeof userMetadata.$inferSelect;
