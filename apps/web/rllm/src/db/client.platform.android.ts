import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { hashKey } from '@tanstack/solid-query';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger } from 'event-logger';
import { fromCapacitorSqlite } from 'event-logger/capacitorjs';

import { processMessage, type TValidEvent, validEventSchema } from '~/queries/mutations';
import { queryClient } from '~/utils/query-client';

import { MAIN_DATABASE_PATH } from './client.constants';
import { createLoggerProxy, setupDb } from './client.platform.common';
import type { DrizzleDB, LoggerInstance } from './client.types';
import { tables } from './schema';

let loggerPromise: null | Promise<LoggerInstance> = null;
let loggerInstance: LoggerInstance | null = null;

let dbPromise: null | Promise<DrizzleDB> = null;
let dbInstance: DrizzleDB | null = null;

const sqlite = new SQLiteConnection(CapacitorSQLite);

async function getConnection() {
  await sqlite.checkConnectionsConsistency();
  const { result: hasConnection } = await sqlite.isConnection(MAIN_DATABASE_PATH, false);
  const db = hasConnection
    ? await sqlite.retrieveConnection(MAIN_DATABASE_PATH, false)
    : await sqlite.createConnection(MAIN_DATABASE_PATH, false, 'secret', 1, false);
  const { result: isOpen } = await db.isDBOpen();
  if (!isOpen) await db.open();
  return db;
}

async function getDb(): Promise<DrizzleDB> {
  if (dbInstance) return dbInstance;
  if (!dbPromise) {
    dbPromise = (async () => {
      await getLogger();
      const drizzleDb = drizzle(
        async function (sql, params, method) {
          const db = await getConnection();
          let rows: Record<string, unknown>[];

          switch (method) {
            case 'all':
            case 'get':
            case 'values': {
              const result = await db.query(sql, params);
              rows = result.values ?? [];
              break;
            }
            case 'run': {
              const { changes } = await db.run(sql, params);
              rows = [{ changes: changes?.changes ?? 0, lastId: changes?.lastId ?? 0 }];
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

      await drizzleDb.get('SELECT 1').execute();

      dbInstance = drizzleDb;
      return drizzleDb;
    })();
  }
  return dbPromise;
}

async function getLogger(): Promise<LoggerInstance> {
  if (loggerInstance) return loggerInstance;
  if (!loggerPromise) {
    loggerPromise = (async () => {
      console.debug('[DB] Loading CapacitorSQLite Instance');
      const instance = await createEventLogger<TValidEvent>({
        db: fromCapacitorSqlite('main', getConnection),
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
            Array.from(uniqueKeys.values()).map((key) =>
              queryClient.invalidateQueries({ queryKey: key })
            )
          );
        },
        validateEvent: (event) => validEventSchema.parse(event)
      });
      await setupDb(instance);
      loggerInstance = instance;
      return instance;
    })();
  }
  return loggerPromise;
}

export const logger = createLoggerProxy(getLogger);

export { getDb, getLogger };
