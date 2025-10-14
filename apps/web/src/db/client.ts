import { debounce } from '@tanstack/solid-pacer';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { HLC } from 'hlc';
import { SQLocalDrizzle } from 'sqlocal/drizzle';

import { getLocalClock } from '~/utils/clock';

import migrations from './migrations.json';
import * as schema from './schema';

const isPersisted = await window.navigator.storage.persisted();
const {
	getDatabaseFile,
	getDatabaseInfo,
	createCallbackFunction,
	transaction,
	driver,
	batchDriver,
	deleteDatabaseFile,
	beginTransaction
} = new SQLocalDrizzle({
	databasePath: isPersisted ? 'rllm.db' : ':sessionStorage:',
	onInit: (sql) => [
		sql`PRAGMA journal_mode=MEMORY;`,
		sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` text PRIMARY KEY NOT NULL, \`value\` text NOT NULL);`
	]
	// verbose: import.meta.env.DEV
});

const db = drizzle(driver, batchDriver, {
	schema
	//logger: {
	//	logQuery(query, params) {
	//		console.trace(query, params);
	//	}
	//}
});

async function runMigrations() {
	const [currentVersion] = await db
		.select({ value: schema.metadata.value })
		.from(schema.metadata)
		.where(eq(schema.metadata.key, 'version'));

	for (const version of Object.keys(migrations).toSorted()) {
		if (currentVersion !== undefined && version <= currentVersion.value) continue;
		console.debug(`Running migration ${version}`);
		const migration = migrations[version as keyof typeof migrations];
		await transaction(async (tx) => {
			await tx.query({
				sql: migration,
				params: []
			});
			await tx.query(
				db
					.insert(schema.metadata)
					.values({ key: 'version', value: version })
					.onConflictDoUpdate({
						target: schema.metadata.key,
						set: { value: version }
					})
			);
		});
		console.debug(`Migration ${version} complete`);
	}
}

const setupDb = async (): Promise<void> => {
	console.debug('[Database Info]', await getDatabaseInfo());
	await runMigrations();
	await createCallbackFunction(
		'push',
		debounce(
			async () => {
				const { pushPendingMessages } = await import('~/sockets/messages');
				pushPendingMessages();
			},
			{ wait: 1000 }
		)
	);
	let clock = HLC.generate();
	await db
		.insert(schema.metadata)
		.values({ key: 'clock', value: clock.toString() })
		.onConflictDoNothing({ target: schema.metadata.key });
	clock = await getLocalClock();
	await db
		.insert(schema.metadata)
		.values({ key: 'clientId', value: clock.clientId })
		.onConflictDoNothing({ target: schema.metadata.key });
	await db.batch([
		db.run(
			sql`CREATE TEMP TRIGGER on_insert_message_push AFTER INSERT ON "messages" WHEN NEW.timestamp LIKE '%${sql.raw(clock.clientId)}' BEGIN SELECT push(); END;`
		)
	]);
};

export {
	beginTransaction,
	db,
	deleteDatabaseFile,
	getDatabaseFile,
	getDatabaseInfo,
	setupDb,
	transaction
};
