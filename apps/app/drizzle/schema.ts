import { sqliteTable, AnySQLiteColumn, text } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const messages = sqliteTable("messages", {
	accountId: text().notNull(),
	clientId: text().notNull(),
	syncedAt: text().notNull(),
	data: text().primaryKey().notNull(),
});

export const metadata = sqliteTable("metadata", {
	key: text().primaryKey().notNull(),
	value: text().notNull(),
});

