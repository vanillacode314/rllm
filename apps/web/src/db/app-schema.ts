import { type } from 'arktype';
import { createSelectSchema } from 'drizzle-arktype';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { TChatSettings } from '~/lib/chat/settings';
import type { TChat as TChatChat, TMessage as TChatMessage } from '~/types/chat';
import type { JsonTree } from '~/utils/tree';

const timestamp = () => text().notNull();
const updatedAt = () => text({ mode: 'json' }).notNull().$type<Record<string, string>>();

const userMetadata = sqliteTable('userMetadata', {
	createdAt: timestamp(),
	id: text().primaryKey().notNull(),
	value: text().notNull(),
	updatedAt: updatedAt()
});
const chatPresets = sqliteTable('chatPresets', {
	createdAt: timestamp(),
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	settings: text({ mode: 'json' }).notNull().$type<TChatSettings>(),
	updatedAt: updatedAt()
});
const providers = sqliteTable('providers', {
	createdAt: timestamp(),
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull().$type<'openai'>(),
	baseUrl: text().notNull(),
	token: text().notNull(),
	defaultModelIds: text({ mode: 'json' }).notNull().$type<string[]>(),
	updatedAt: updatedAt()
});
const chats = sqliteTable('chats', {
	createdAt: timestamp(),
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	tags: text({ mode: 'json' })
		.notNull()
		.$type<string[]>()
		.default(sql`"[]"`),
	finished: integer({ mode: 'boolean' })
		.notNull()
		.default(sql`1`),
	messages: text({ mode: 'json' }).notNull().$type<JsonTree<TChatMessage>>(),
	settings: text({ mode: 'json' }).notNull().$type<TChatChat['settings']>(),
	updatedAt: updatedAt()
});
const mcps = sqliteTable('mcps', {
	createdAt: timestamp(),
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	url: text().notNull(),
	updatedAt: updatedAt()
});
export const tables = { mcps, chats, providers, userMetadata, chatPresets };

export const providersSchema = createSelectSchema(providers, {
	baseUrl: type('string.url'),
	defaultModelIds: type('string[] > 0')
});
export const userMetadataSchema = createSelectSchema(userMetadata);
export const chatsSchema = createSelectSchema(chats, {
	tags: type('string[]')
	// settings: chatSchema.get('settings')
	// messages: JsonTreeSchema(messageSchema)
});
export const mcpsSchema = createSelectSchema(mcps);
export const chatPresetsSchema = createSelectSchema(chatPresets);

export type TChat = typeof chats.$inferSelect;
export type TChatPreset = typeof chatPresets.$inferSelect;
export type TMCP = typeof mcps.$inferSelect;
export type TProvider = typeof providers.$inferSelect;
export type TUserMetadata = typeof userMetadata.$inferSelect;
