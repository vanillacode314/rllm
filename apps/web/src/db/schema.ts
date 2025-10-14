import { type } from 'arktype';
import { createSelectSchema } from 'drizzle-arktype';
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { TValidMessage } from '~/queries/mutations';
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
const metadata = sqliteTable('metadata', {
	key: text().primaryKey().notNull(),
	value: text().notNull()
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
const events = sqliteTable('events', {
	timestamp: timestamp().primaryKey().notNull(),
	user_intent: text().notNull().$type<TValidMessage['user_intent']>(),
	meta: text({ mode: 'json' }).notNull().$type<Record<string, unknown>>()
});

const metadataSchema = createSelectSchema(metadata);
const providersSchema = createSelectSchema(providers, {
	baseUrl: type('string.url'),
	defaultModelIds: type('string[] > 0')
});
const eventSchema = createSelectSchema(events);
const userMetadataSchema = createSelectSchema(userMetadata);
const chatsSchema = createSelectSchema(chats, {
	tags: type('string[]')
	// settings: chatSchema.get('settings')
	// messages: JsonTreeSchema(messageSchema)
});
const mcpsSchema = createSelectSchema(mcps);

type TChat = typeof chats.$inferSelect;
type TEvent = typeof events.$inferSelect;
type TMCP = typeof mcps.$inferSelect;
type TMetadata = typeof metadata.$inferSelect;
type TProvider = typeof providers.$inferSelect;
type TUserMetadata = typeof userMetadata.$inferSelect;

export {
	chats,
	chatsSchema,
	events,
	eventSchema,
	mcps,
	mcpsSchema,
	metadata,
	metadataSchema,
	providers,
	providersSchema,
	userMetadata,
	userMetadataSchema
};
export type { TChat, TEvent, TMCP, TMetadata, TProvider, TUserMetadata };
