import { InferSelectModel } from 'drizzle-orm';
import { blob, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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

type TMessage = InferSelectModel<typeof messages>;
type TMetadata = InferSelectModel<typeof metadata>;

export { messages, metadata };
export type { TMessage, TMetadata };
