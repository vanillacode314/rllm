import { createSelectSchema } from 'drizzle-arktype';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { type TValidMessage, validMessage } from '~/queries/mutations';

const timestamp = () => text().notNull();

const metadata = sqliteTable('metadata', {
	key: text().primaryKey().notNull(),
	value: text().notNull()
});
const events = sqliteTable('events', {
	timestamp: timestamp().primaryKey().notNull(),
	type: text().notNull().$type<TValidMessage['type']>(),
	data: text().notNull().$type<TValidMessage['data']>()
});
export const tables = { metadata, events };

export const metadataSchema = createSelectSchema(metadata);
export type TMetadata = typeof metadata.$inferSelect;

export const eventSchema = validMessage.merge({ timestamp: 'string' });
export type TEvent = typeof eventSchema.infer;
