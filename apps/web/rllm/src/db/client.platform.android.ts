import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { Filesystem } from '@capacitor/filesystem';
import { hashKey } from '@tanstack/solid-query';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger } from 'event-logger';
import { fromCapacitorSqlite } from 'event-logger/copacitorjs';

import { processMessage, type TValidEvent, validEventSchema } from '~/queries/mutations';
import { queryClient } from '~/utils/query-client';

import { DATABASE_PATH } from './client.constants';
import { tables } from './schema';

async function loadCapacitorSqliteDb() {
  console.debug('[DB] Loading CapacitorSQLite Instance');
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const { result } = await sqlite.checkConnectionsConsistency();
  const db = result
    ? await sqlite.retrieveConnection(DATABASE_PATH, false)
    : await sqlite.createConnection(DATABASE_PATH, false, 'secret', 1, false);
  await db.open();
  const loggerDb = fromCapacitorSqlite(db);
  const drizzleDb = drizzle(
    async function (sql, params, method) {
      let rows: any[] = [];

      switch (method) {
        case 'all':
        case 'get':
        case 'values': {
          const result = await db.query(sql, params);
          rows = result.values ?? [];
          break;
        }
        case 'run': {
          const result = await db.run(sql, params);
          rows = [
            {
              changes: result.changes?.changes ?? 0,
              lastId: result.changes?.lastId ?? 0
            }
          ];
          break;
        }
        default:
          throw new Error(`Unknown method: ${method}`);
      }

      const mappedRows = rows.map((row) => Object.values(row));
      return { rows: method === 'get' ? mappedRows[0] : mappedRows };
    },
    { schema: tables }
  );
  async function getDatabaseSize() {
    const info = await Filesystem.stat({
      path: '/data/data/com.raqueeb.rllm/databases/' + DATABASE_PATH.slice(0, -3) + 'SQLite.db'
    });
    return info.size;
  }

  function deleteDatabaseFile() {
    return Filesystem.deleteFile({
      path: '/data/data/com.raqueeb.rllm/databases/' + DATABASE_PATH.slice(0, -3) + 'SQLite.db'
    });
  }

  return { deleteDatabaseFile, drizzleDb, getDatabaseSize, loggerDb };
}

const {
  deleteDatabaseFile,
  drizzleDb: db,
  getDatabaseSize,
  loggerDb
} = await loadCapacitorSqliteDb();

const logger = await createEventLogger<TValidEvent>({
  db: loggerDb,
  eventToUpdates: processMessage,
  invalidate: async (items) => {
    const uniqueKeys = new Map<string, string[]>();
    for (const { keys } of items) {
      for (const key of keys) {
        const hash = hashKey(key);
        if (!uniqueKeys.has(hash)) uniqueKeys.set(hash, key);
      }
    }
    await Promise.all(
      uniqueKeys.values().map((key) => queryClient.invalidateQueries({ queryKey: key }))
    );
  },
  validateEvent: (event) => validEventSchema.parse(event)
});

export { db, deleteDatabaseFile, getDatabaseSize, logger };
