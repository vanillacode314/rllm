import { hashKey } from '@tanstack/solid-query';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger } from 'event-logger';
import { fromSQLocal } from 'event-logger/sqlocal';
import { SQLocal } from 'sqlocal';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import { processMessage, type TValidEvent, validEventSchema } from '~/queries/mutations';
import { queryClient } from '~/utils/query-client';

import { DATABASE_PATH } from './client.constants';
import { tables } from './schema';

async function loadSQLocalDb() {
  console.debug('[DB] Loading SQLocal Instance');
  const { batchDriver, deleteDatabaseFile, driver, getDatabaseInfo } = new SQLocalDrizzle({
    databasePath: DATABASE_PATH,
    onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
  });
  console.debug('[DB] SQLocal Instance Info', await getDatabaseInfo());
  const drizzleDb = drizzle(driver, batchDriver, { schema: tables });
  const loggerDb = fromSQLocal(
    new SQLocal({
      databasePath: DATABASE_PATH,
      onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
    })
  );
  async function getDatabaseSize() {
    const info = await getDatabaseInfo();
    return info.databaseSizeBytes;
  }
  return { deleteDatabaseFile, drizzleDb, getDatabaseSize, loggerDb };
}

const { deleteDatabaseFile, drizzleDb: db, getDatabaseSize, loggerDb } = await loadSQLocalDb();

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
