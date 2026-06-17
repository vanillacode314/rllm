import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Transaction } from 'sqlocal';

import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { AsyncResult, Result } from 'ts-result-option';

import { db, logger } from '~/db/client';

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

interface WithTransactionFn {
  <T, E>(fn: (tx: Transaction) => AsyncResult<T, E>): AsyncResult<T, E | Error>;
  <T, E>(fn: (tx: Transaction) => Result<T, E>): AsyncResult<T, E | Error>;
  <T, E>(fn: (tx: Transaction) => Promise<Result<T, E>>): AsyncResult<T, E | Error>;
  <T>(fn: (tx: Transaction) => Promise<T>): AsyncResult<T, Error>;
}

async function runCustomQuery<T extends object>(query: SQL): Promise<T[]> {
  const { columns } = (await db.run(query)) as { columns: any[] };
  const rows = await db.all(query);
  return tableToObject<T>(rows, columns);
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
      return logger.db.transaction(async (tx) => {
        const result = await fn(tx);
        if (Result.isResult(result)) {
          if (result.isErr()) {
            throw result.unwrapErr();
          }
        }
        return result;
      });
    },
    (e) => new Error('Failed to run transaction', { cause: e })
  );

export { buildConflictUpdateColumns, runCustomQuery, tableToObject, withTransaction };
