import { createSelectSchema } from 'drizzle-arktype';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { type TValidEvent, ValidEvent } from '~/queries/mutations';

const timestamp = () => text().notNull();

const metadata = sqliteTable('metadata', {
	key: text().primaryKey().notNull(),
	value: text().notNull()
});
const events = sqliteTable('events', {
	timestamp: timestamp().primaryKey().notNull(),
	type: text().notNull(),
	data: text().notNull(),
	version: text()
});
export const tables = { metadata, events };

export const metadataSchema = createSelectSchema(metadata);
export type TMetadata = typeof metadata.$inferSelect;

export const eventSchema = ValidEvent;
export type TEvent = TValidEvent;
