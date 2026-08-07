import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

import { Mutex } from 'mutex';

import type { TSqlDB } from '..';

export function fromCapacitorSqlite(getDb: () => Promise<SQLiteDBConnection>): TSqlDB {
  const transactionMutex = new Mutex();
  const loggerDb = {
    async batch(statements, tx = true) {
      const db = await getDb();
      await db.executeSet(
        statements.map(({ params, sql }) => ({ statement: sql, values: params })),
        tx
      );
    },
    async query(statement) {
      const db = await getDb();
      const result = await db.query(statement.sql, statement.params);
      return result.values ?? [];
    },
    async transaction(callback) {
      const db = await getDb();
      await transactionMutex.lock();
      await db.beginTransaction();
      try {
        const result = await callback({
          batch: (statements) => loggerDb.batch(statements, false),
          query: loggerDb.query
        });
        const db = await getDb();
        await db.commitTransaction();
        return result;
      } catch (e) {
        const db = await getDb();
        await db.rollbackTransaction();
        throw e;
      } finally {
        transactionMutex.unlock();
      }
    }
  } satisfies TSqlDB;
  return loggerDb;
}
