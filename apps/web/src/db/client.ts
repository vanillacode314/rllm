import { debounce } from '@tanstack/solid-pacer';
import { hashKey } from '@tanstack/solid-query';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createEventLogger } from 'event-logger';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { AsyncResult } from 'ts-result-option';

import { processMessage, type TValidEvent, ValidEvent } from '~/queries/mutations';
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

export const logger = await createEventLogger<TValidEvent>({
	config: { databasePath: 'rllm.db' },
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
	eventToUpdates: (event) => processMessage(event),
	validateEvent: (event) => ValidEvent.parse(event),
	onNewEvent: debounce(
		async () => {
			const { pushPendingMessages } = await import('~/sockets/messages');
			await pushPendingMessages().unwrap();
		},
		{ wait: 1000 }
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

const setupDb = () =>
	AsyncResult.from<void, Error>(
		async function () {
			console.debug('[Database Info]', await getDatabaseInfo());
			const currentVersion = await logger.getVersion();

			for (const version of Object.keys(migrations).toSorted()) {
				if (currentVersion !== undefined && version <= currentVersion) continue;
				console.debug(`Running migration ${version}`);
				const statements = migrations[version as keyof typeof migrations];
				await logger.db.transaction(async (tx) => {
					for (const statement of statements) {
						await tx.query({
							sql: statement,
							params: []
						});
					}
					await logger.setVersion(version, tx);
				});
				console.debug(`Migration ${version} applied`);
			}

			console.table(await logger.db.sql`SELECT * FROM metadata;`);
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
