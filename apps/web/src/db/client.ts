import { debounce } from '@tanstack/solid-pacer'
import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { HLC } from 'hlc'
import { SQLocalDrizzle } from 'sqlocal/drizzle'

import { getLocalClock } from '~/utils/clock'
import { once } from '~/utils/functions'

import migrations from './migrations.json'
import * as schema from './schema'

const {
  getDatabaseInfo,
  createCallbackFunction,
  transaction,
  driver,
  batchDriver,
  deleteDatabaseFile,
  beginTransaction,
} = new SQLocalDrizzle({
  databasePath: 'rllm.db',
  onInit: (sql) => [
    sql`PRAGMA journal_mode=MEMORY;`,
    sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` text PRIMARY KEY NOT NULL, \`value\` text NOT NULL);`,
  ],
  // verbose: import.meta.env.DEV
})

const db = drizzle(driver, batchDriver, {
  schema,
  //logger: {
  //	logQuery(query, params) {
  //		console.trace(query, params);
  //	}
  //}
})

async function runMigrations() {
  console.log('[Database Info]', await getDatabaseInfo())
  const allVersions = Object.keys(migrations).sort()
  const [currentVersion] = await db
    .select({ value: schema.metadata.value })
    .from(schema.metadata)
    .where(eq(schema.metadata.key, 'version'))
  const migrationsToRun = Object.entries(migrations)
    .filter(([version]) => {
      return currentVersion === undefined
        ? true
        : version > currentVersion.value
    })
    .map(([_, migration]) => migration)
  if (migrationsToRun.length === 0) return

  // @ts-ignore: typescript cannot tell that migrationsToRun.length is always > 0
  await db.batch([
    ...migrationsToRun.map((migration) => db.run(sql.raw(migration.trim()))),
    db
      .insert(schema.metadata)
      .values({ key: 'version', value: allVersions.at(-1)! })
      .onConflictDoUpdate({
        target: schema.metadata.key,
        set: { value: allVersions.at(-1) },
      }),
  ])
}

const setupDb = once(async (): Promise<void> => {
  await createCallbackFunction(
    'push',
    debounce(
      async () => {
        const { pushPendingMessages } = await import('~/sockets/messages')
        pushPendingMessages()
      },
      { wait: 1000 },
    ),
  )
  await runMigrations()
  let clock = HLC.generate()
  await db
    .insert(schema.metadata)
    .values({ key: 'clock', value: clock.toString() })
    .onConflictDoNothing({ target: schema.metadata.key })
  clock = await getLocalClock()
  await db
    .insert(schema.metadata)
    .values({ key: 'clientId', value: clock.clientId })
    .onConflictDoNothing({ target: schema.metadata.key })
  await db.batch([
    db.run(
      sql`CREATE TEMP TRIGGER on_insert_message_push AFTER INSERT ON "messages" WHEN NEW.timestamp LIKE '%${sql.raw(clock.clientId)}' BEGIN SELECT push(); END;`,
    ),
  ])
})

export {
  beginTransaction,
  db,
  deleteDatabaseFile,
  getDatabaseInfo,
  setupDb,
  transaction,
}
