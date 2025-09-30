import { eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { db } from '~/db/client.ts';
import * as schema from '~/db/schema.ts';

const buildConflictUpdateColumns = <
	T extends PgTable | SQLiteTable,
	Q extends keyof T['_']['columns']
>(
	table: T,
	columns: Q[]
) => {
	const cls = getTableColumns(table);

	return columns.reduce(
		(acc, column) => {
			const colName = cls[column].name;
			acc[column] = sql.raw(`excluded.\`${colName}\``);

			return acc;
		},
		{} as Record<Q, SQL>
	);
};

async function getMetadata(key: string): Promise<string | undefined> {
	const [row] = await db
		.select({ value: schema.metadata.value })
		.from(schema.metadata)
		.where(eq(schema.metadata.key, key));
	return row ? row.value : row;
}

async function setMetadata(key: string, value: string): Promise<void> {
	await db.insert(schema.metadata).values({ key, value }).onConflictDoUpdate({
		set: { value },
		target: schema.metadata.key
	});
}

export { buildConflictUpdateColumns, getMetadata, setMetadata };
