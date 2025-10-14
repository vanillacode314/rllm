import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Transaction } from 'sqlocal';

import { eq, getTableColumns, sql, type SQL } from 'drizzle-orm';
import { AsyncResult, Option, Result } from 'ts-result-option';

import { beginTransaction, db } from '~/db/client';
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

const getMetadata = (key: string, tx?: Transaction): AsyncResult<Option<string>, Error> =>
	AsyncResult.from(
		async function () {
			const query = db
				.select({ value: schema.metadata.value })
				.from(schema.metadata)
				.where(eq(schema.metadata.key, key));

			const data = await (tx ? tx.query(query) : query);
			return Option.from(data[0]?.value ?? null);
		},
		(e) => new Error(`Failed to get metadata ${key}`, { cause: e })
	);

async function runCustomQuery<T extends object>(query: SQL): Promise<T[]> {
	const { columns } = (await db.run(query)) as { columns: any[] };
	const rows = await db.all(query);
	return tableToObject<T>(rows, columns);
}

const setMetadata = (key: string, value: string, tx?: Transaction): AsyncResult<void, Error> =>
	AsyncResult.from(
		async function () {
			const query = db.insert(schema.metadata).values({ key, value }).onConflictDoUpdate({
				target: schema.metadata.key,
				set: { value }
			});

			await (tx ? tx.query(query) : query);
		},
		(e) => new Error(`Failed to set metadata(${key}:${value})`, { cause: e })
	);

interface WithTransactionFn {
	<T, E>(fn: (tx: Transaction) => AsyncResult<T, E>): AsyncResult<T, E | Error>;
	<T, E>(fn: (tx: Transaction) => Result<T, E>): AsyncResult<T, E | Error>;
	<T, E>(fn: (tx: Transaction) => Promise<Result<T, E>>): AsyncResult<T, E | Error>;
	<T>(fn: (tx: Transaction) => Promise<T>): AsyncResult<T, Error>;
}

function tableToObject<T extends object>(rows: never[][], columns: (keyof T)[]): T[] {
	return rows.map((row) => {
		const obj = {} as T;
		for (let i = 0; i < row.length; i++) {
			obj[columns[i]] = row[i];
		}
		return obj;
	});
}

const withTransaction: WithTransactionFn = (fn) =>
	AsyncResult.from(
		async () => {
			const tx = await beginTransaction();
			try {
				const result = await fn(tx);
				if (Result.isResult(result)) {
					if (result.isErr()) {
						await tx.rollback();
						return result;
					}
				}
				await tx.commit();
				return result;
			} catch (e) {
				await tx.rollback();
				throw e;
			}
		},
		(e) => new Error('Failed to run transaction', { cause: e })
	);

export {
	buildConflictUpdateColumns,
	getMetadata,
	runCustomQuery,
	setMetadata,
	tableToObject,
	withTransaction
};
