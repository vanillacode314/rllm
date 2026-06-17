import { hashKey } from '@tanstack/solid-query';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger, type TSqlDB, type TStatement } from 'event-logger';
import { fromSQLocal } from 'event-logger/sqlocal';
import { SQLocal } from 'sqlocal';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { AsyncResult } from 'ts-result-option';

import { processMessage, type TValidEvent, validEventSchema } from '~/queries/mutations';
import { queryClient } from '~/utils/query-client';

import migrations from './migrations.json';
import { tables } from './schema';

export const DATABASE_PATH = 'rllm.db';

async function loadSQLocalDb() {
  console.debug('[DB] Loading SQLocal Instance');
  const { batchDriver, deleteDatabaseFile, driver, getDatabaseInfo } = new SQLocalDrizzle({
    databasePath: DATABASE_PATH,
    onInit: (sql) => [sql`PRAGMA journal_mode=MEMORY;`]
    // verbose: import.meta.env.DEV
  });
  console.debug('[DB] SQLocal Instance Info', await getDatabaseInfo());
  const drizzleDb = drizzle(driver, batchDriver, {
    schema: tables
    //logger: {
    //	logQuery(query, params) {
    //		console.trace(query, params);
    //	}
    //}
  });
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

export const logger = await createEventLogger<TValidEvent>({
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

const setupDb = () =>
  AsyncResult.from<void, Error>(
    async function () {
      const currentVersion = await logger.getVersion();

      for (const version of Object.keys(migrations).toSorted()) {
        if (currentVersion !== undefined && version <= currentVersion) continue;
        console.debug(`Running migration ${version}`);
        const statements = migrations[version as keyof typeof migrations];
        // oxlint-disable-next-line no-await-in-loop
        await logger.db.transaction(async (tx) => {
          await tx.batch(
            statements.map((statement) => ({
              params: [],
              sql: statement
            }))
          );
          await logger.setVersion(version, tx);
        });
        console.debug(`Migration ${version} applied`);
      }

      console.debug(
        '[DB Metadata]',
        Object.fromEntries(
          (
            await logger.db.query<{ key: string; value: string }>(
              logger.sql`SELECT * FROM metadata;`
            )
          ).map(({ key, value }) => [key, value])
        )
      );
    },
    (e) => new Error('Failed to setup database', { cause: e })
  );

export { db, deleteDatabaseFile, getDatabaseSize, setupDb };
