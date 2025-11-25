import { debounce } from '@tanstack/solid-pacer';
import { hashKey } from '@tanstack/solid-query';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger } from 'event-logger';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { AsyncResult } from 'ts-result-option';
import { Compile } from 'typebox/compile';

import {
	processMessage,
	type TValidMessage,
	validMessage,
	ValidMessage
} from '~/queries/mutations';
import { queryClient } from '~/utils/query-client';

import migrations from './migrations.json';
import { tables } from './schema';

const {
	batch,
	getDatabaseFile,
	getDatabaseInfo,
	transaction,
	driver,
	batchDriver,
	deleteDatabaseFile,
	beginTransaction
} = new SQLocalDrizzle({
	databasePath: 'rllm.db',
	onInit: (sql) => [
		sql`PRAGMA journal_mode=MEMORY;`,
		sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` text PRIMARY KEY NOT NULL, \`value\` text NOT NULL);`
	]
	// verbose: import.meta.env.DEV
});

const ValidateMessage = Compile(ValidMessage);
export const logger = await createEventLogger<TValidMessage>({
	config: { databasePath: 'rllm.db' },
	invalidate: async (keys) => {
		const uniqueKeys = keys
			.reduce((keys, value) => {
				const hash = hashKey(value);
				if (!keys.has(hash)) keys.set(hash, value);
				return keys;
			}, new Map<string, string[]>())
			.values()
			.toArray();
		await Promise.all(uniqueKeys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
	},
	eventToUpdates: (event) => processMessage(event),
	validateEvent: (event) => validMessage.assert(event),
	onNewEvent: debounce(
		async () => {
			const { pushPendingMessages } = await import('~/sockets/messages');
			await pushPendingMessages().unwrap();
		},
		{ wait: 5000 }
	)
});

const db = drizzle(driver, batchDriver, {
	schema: tables
	//logger: {
	//	logQuery(query, params) {
	//		console.trace(query, params);
	//	}
	//}
});

async function runMigrations() {
	const [currentVersion] = await db
		.select({ value: tables.metadata.value })
		.from(tables.metadata)
		.where(eq(tables.metadata.key, 'version'));

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
					.insert(tables.metadata)
					.values({ key: 'version', value: version })
					.onConflictDoUpdate({
						target: tables.metadata.key,
						set: { value: version }
					})
			);
		});
		console.debug(`Migration ${version} complete`);
	}
}

const setupDb = () =>
	AsyncResult.from<void, Error>(
		async function () {
			console.debug('[Database Info]', await getDatabaseInfo());
			await runMigrations();
		},
		(e) => new Error('Failed to setup database', { cause: e })
	);
export {
	batch,
	beginTransaction,
	db,
	deleteDatabaseFile,
	getDatabaseFile,
	getDatabaseInfo,
	setupDb,
	transaction
};
