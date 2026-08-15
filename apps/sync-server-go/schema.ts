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

const merkleTrees = sqliteTable('merkleTrees', {
  accountId: text().notNull().primaryKey(),
  tree: text().notNull()
});

const messages = sqliteTable(
  'messages',
  {
    accountId: text().notNull(),
    clientId: text().notNull(),
    data: blob({ mode: 'buffer' }).notNull(),
    signature: text().notNull(),
    timestamp: timestamp()
  },
  (t) => [primaryKey({ columns: [t.accountId, t.timestamp] })]
);

type TMerkleTree = InferSelectModel<typeof merkleTrees>;
type TMessage = InferSelectModel<typeof messages>;
type TMetadata = InferSelectModel<typeof metadata>;

export { merkleTrees, messages, metadata };
export type { TMerkleTree, TMessage, TMetadata };
