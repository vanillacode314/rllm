import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Transaction } from 'sqlocal';

import { getTableColumns, sql, type SQL } from 'drizzle-orm';
import { AsyncResult, Result } from 'ts-result-option';

import { logger } from '~/db/client';

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

export async function parseDbRowsInPlace<TRow extends Record<string, unknown>>(
  rowsPromise: TRow[] | Promise<TRow[]>,
  opts: Partial<{
    jsonKeys: (keyof TRow)[];
    booleanKeys: (keyof TRow)[];
  }> = {}
): Promise<TRow[]> {
  const rows = await rowsPromise;
  const { jsonKeys = [], booleanKeys = [] } = opts;
  for (const row of rows) {
    for (const key of jsonKeys) {
      if (key in row) {
        row[key] = JSON.parse(row[key] as string);
      }
    }
    for (const key of booleanKeys) {
      if (key in row) {
        row[key] = Boolean(row[key]) as never;
      }
    }
  }
  return rows;
}

export { buildConflictUpdateColumns, tableToObject, withTransaction };
