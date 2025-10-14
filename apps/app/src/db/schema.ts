import { createSelectSchema } from 'drizzle-arktype';
import { sql } from 'drizzle-orm';
import {
	blob,
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text
} from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

const timestamp = () => text().notNull();

const metadata = sqliteTable('metadata', {
	key: text()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	value: text().notNull()
});

const messages = sqliteTable(
	'messages',
	{
		accountId: text().notNull(),
		clientId: text().notNull(),
		data: blob({ mode: 'buffer' }).notNull(),
		syncedAt: timestamp()
	},
	(t) => [primaryKey({ columns: [t.accountId, t.data] })]
);

const metadataSchema = createSelectSchema(metadata);
const messagesSchema = createSelectSchema(messages);

type TMessage = typeof messagesSchema.infer;
type TMetadata = typeof metadataSchema.infer;

export { messages, messagesSchema, metadata, metadataSchema };
export type { TMessage, TMetadata };
