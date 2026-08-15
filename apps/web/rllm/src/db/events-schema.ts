import { sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { createSelectSchema } from 'drizzle-zod';

import { type TValidEvent, validEventSchema } from '~/queries/mutations';

const timestamp = () => text().notNull();

const metadata = sqliteTable('metadata', {
  key: text().primaryKey(),
  value: text().notNull()
});
const events = sqliteTable('events', {
  data: text({ mode: 'json' }).notNull(),
  timestamp: timestamp().primaryKey(),
  type: text().notNull(),
  version: text().notNull()
});
const updates = sqliteTable(
  'updates',
  {
    column: text().notNull(),
    id: text().primaryKey(),
    rowId: text().notNull(),
    table: text().notNull(),
    timestamp: timestamp()
  },
  (t) => [unique().on(t.table, t.rowId, t.column)]
);
export const tables = { events, metadata, updates };

export const metadataSchema = createSelectSchema(metadata);
export type TMetadata = typeof metadata.$inferSelect;

export const eventSchema = validEventSchema;
export type TEvent = TValidEvent;

export const updateSchema = createSelectSchema(updates);
export type TUpdate = typeof updates.$inferSelect;
