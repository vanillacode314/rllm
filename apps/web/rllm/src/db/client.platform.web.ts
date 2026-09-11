import { hashKey } from '@tanstack/solid-query';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger } from 'event-logger';
import { fromSQLocal } from 'event-logger/sqlocal';
import { SQLocal } from 'sqlocal';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

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

async function getDb(): Promise<DrizzleDB> {
  if (dbInstance) return dbInstance;
  if (!dbPromise) {
    dbPromise = (async () => {
      await getLogger();
      const { batchDriver, driver, getDatabaseInfo } = new SQLocalDrizzle({
        databasePath: MAIN_DATABASE_PATH,
        onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
      });
      void getDatabaseInfo().then((info) => console.debug('[DB] SQLocal Instance Info', info));
      const drizzleDb = drizzle(driver, batchDriver, { schema: tables });

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
      const loggerDb = fromSQLocal(
        new SQLocal({
          databasePath: MAIN_DATABASE_PATH,
          onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
        })
      );
      const instance = await createEventLogger<TValidEvent>({
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
