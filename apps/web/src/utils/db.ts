import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Transaction } from 'sqlocal';

import { eq, getTableColumns, sql, type SQL } from 'drizzle-orm';

import { db } from '~/db/client';
import * as schema from '~/db/schema';

const buildConflictUpdateColumns = <T extends SQLiteTable, Q extends keyof T['_']['columns']>(
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
	return row?.value;
}

async function runCustomQuery<T extends object>(query: SQL): Promise<T[]> {
	const { columns } = (await db.run(query)) as { columns: any[] };
	const rows = await db.all(query);
	return tableToObject<T>(rows, columns);
}

async function setMetadata(key: string, value: string, tx?: Transaction): Promise<void> {
	const query = db.insert(schema.metadata).values({ key, value }).onConflictDoUpdate({
		target: schema.metadata.key,
		set: { value }
	});

	if (tx) {
		await tx.query(query);
	} else {
		await query;
	}
}

function tableToObject<T extends object>(rows: unknown, columns: (keyof T)[]): T[] {
	return rows.map((row) => {
		const obj = {} as T;
		for (let i = 0; i < row.length; i++) {
			obj[columns[i]] = row[i];
		}
		return obj;
	});
}

export { buildConflictUpdateColumns, getMetadata, runCustomQuery, setMetadata, tableToObject };
