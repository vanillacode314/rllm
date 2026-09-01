import type { SQLiteDBConnection } from '@capacitor-community/sqlite';

import type { TSqlDB } from '..';

export function fromCapacitorSqlite(id: string, getDb: () => Promise<SQLiteDBConnection>): TSqlDB {
  const loggerDb = {
    blobType: 'string',
    async batch(statements, tx = true) {
      const db = await getDb();
      if (tx) {
        await navigator.locks.request(`vector-db-transaction:${id}`, () =>
          db.executeSet(
            statements.map(({ params, sql }) => ({ statement: sql, values: params })),
            tx
          )
        );
      } else {
        await db.executeSet(
          statements.map(({ params, sql }) => ({ statement: sql, values: params })),
          tx
        );
      }
    },
    async query(statement) {
      const db = await getDb();
      const result = await db.query(statement.sql, statement.params);
      return result.values ?? [];
    },
    async transaction(callback) {
      const db = await getDb();
      return await navigator.locks.request(`vector-db-transaction:${id}`, async () => {
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
        }
      });
    }
  } satisfies TSqlDB;
  return loggerDb;
}
