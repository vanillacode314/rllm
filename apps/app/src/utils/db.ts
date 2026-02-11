import { eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { SQLiteTable } from 'drizzle-orm/sqlite-core';

import { db, TTransaction } from '~/db/client';
import * as schema from '~/db/schema';

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

async function getMetadata(key: string, tx?: TTransaction): Promise<string | undefined> {
	if (!tx) return db.transaction((tx) => getMetadata(key, tx));
	const [row] = await tx
		.select({ value: schema.metadata.value })
		.from(schema.metadata)
		.where(eq(schema.metadata.key, key));
	return row ? row.value : row;
}

async function setMetadata(key: string, value: string, tx?: TTransaction): Promise<void> {
	if (!tx) return db.transaction((tx) => setMetadata(key, value, tx));
	await tx.insert(schema.metadata).values({ key, value }).onConflictDoUpdate({
		set: { value },
		target: schema.metadata.key
	});
}

export { buildConflictUpdateColumns, getMetadata, setMetadata };
