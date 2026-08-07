import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

import { Mutex } from 'mutex';

import type { TSqlDB } from '..';

export function fromCapacitorSqlite(db: SQLiteDBConnection): TSqlDB {
  const transactionMutex = new Mutex();
  const loggerDb = {
    async batch(statements, tx = true) {
      await db.executeSet(
        statements.map(({ params, sql }) => ({ statement: sql, values: params })),
        tx
      );
    },
    async query(statement) {
      const result = await db.query(statement.sql, statement.params);
      return result.values ?? [];
    },
    async transaction(callback) {
      await transactionMutex.lock();
      await db.beginTransaction();
      try {
        const result = await callback({
          batch: (statements) => loggerDb.batch(statements, false),
          query: loggerDb.query
        });
        await db.commitTransaction();
        return result;
      } catch (e) {
        await db.rollbackTransaction();
        throw e;
      } finally {
        transactionMutex.unlock();
      }
    }
  } satisfies TSqlDB;
  return loggerDb;
}
