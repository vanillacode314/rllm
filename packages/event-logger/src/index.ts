import { HLC } from 'hlc';
import { type ClientConfig, SQLocal, type Transaction } from 'sqlocal';

export type TConfig<TEvent extends Omit<TBaseEvent, 'timestamp' | 'version'>> = {
	config: ClientConfig;
	eventToUpdates: (
		event: NoInfer<TEvent & { timestamp: string; version: string }>,
		tx: TTransaction
	) => MaybePromise<TUpdate[]>;
	invalidate?: (
		items: Array<{
			event: NoInfer<TEvent & { timestamp: string; version: string }>;
			keys: string[][];
		}>
	) => MaybePromise<void>;
	onNewEvent?: () => MaybePromise<void>;
	validateEvent?: (event: unknown) => TEvent;
};
export type TUpdate =
	| {
			data: Record<string, unknown>;
			id: string;
			invalidate?: Array<string[]>;
			operation: 'insert' | 'update' | 'upsert';
			table: string;
	  }
	| {
			id: string;
			invalidate?: Array<string[]>;
			operation: 'delete';
			table: string;
	  };
interface Logger<T extends TBaseEvent> {
	db: SQLocal;
	dispatch: (
		...events: Array<
			Omit<T, 'timestamp' | 'version'> & { dontLog?: boolean; timestamp?: string; version?: string }
		>
	) => Promise<void>;
	getClientId: () => Promise<string>;
	getClock: () => Promise<HLC>;
	getLatestReceivedAt: (sourceId: string) => Promise<string>;
	getLatestSentAt: (sourceId: string) => Promise<string>;
	getMetadata: (key: string) => Promise<null | string>;
	getUnsyncedEvents: (
		sourceId: string,
		limit?: number
	) => Promise<{ events: T[]; hasMore: boolean }>;
	getVersion: () => Promise<string | undefined>;
	on: <U extends T, TType extends U['type']>(
		type: TType,
		handler: (data: (U & { type: TType })['data'], timestamp: string) => void,
		opts?: { self?: boolean }
	) => () => void;
	receive: (
		sourceId: string,
		events: Array<T & { syncedAt: string; timestamp: string }>,
		tx?: TTransaction
	) => Promise<() => Promise<void>>;
	setLatestSentAt: (sourceId: string, timestamp: string) => Promise<void>;
	setMetadata: (key: string, value: string) => Promise<void>;
	setVersion: (version: string, tx?: TTransaction) => Promise<void>;
}
type MaybePromise<T> = Promise<T> | T;
type TBaseEvent = { data: unknown; timestamp: string; type: string; version: string };

type TTransaction = Pick<Transaction, 'query'>;

export async function createEventLogger<TEvent extends Omit<TBaseEvent, 'timestamp' | 'version'>>({
	config,
	eventToUpdates,
	invalidate,
	onNewEvent,
	validateEvent
}: TConfig<TEvent>): Promise<Logger<TEvent & { timestamp: string; version: string }>> {
	const newClock = HLC.generate();
	const db = new SQLocal({
		...config,
		onInit: (sql) => [
			sql`PRAGMA journal_mode=MEMORY;`,
			sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` text PRIMARY KEY NOT NULL, \`value\` text NOT NULL);`,
			sql`INSERT OR IGNORE INTO \`metadata\` (\`key\`, \`value\`) VALUES ('clock', ${newClock.toString()}), ('clientId', ${newClock.clientId});`,
			sql`CREATE TABLE IF NOT EXISTS \`events\` (\`timestamp\` text PRIMARY KEY NOT NULL, \`type\` text NOT NULL, \`data\` text NOT NULL, \`version\` text NOT NULL);`,
			sql`CREATE TABLE IF NOT EXISTS \`sync_state\` (\`sourceId\` text PRIMARY KEY NOT NULL, \`latest_received\` text, \`latest_sent\` text);`,
			sql`CREATE TABLE IF NOT EXISTS \`sync_state_missing\` (\`sourceId\` text NOT NULL, \`timestamp\` text NOT NULL, PRIMARY KEY (\`sourceId\`, \`timestamp\`));`,
			sql`CREATE TABLE IF NOT EXISTS \`pendingEvents\` (\`id\` text NOT NULL, \`table\` text NOT NULL, \`timestamp\` text NOT NULL, \`data\` text NOT NULL, \`operation\` text NOT NULL, PRIMARY KEY (\`id\`, \`table\`));`,
			...(config.onInit?.(sql) ?? [])
		]
	});
	const query = <T extends Record<string, unknown>>(query: { params: unknown[]; sql: string }) =>
		db.batch(() => [query]).then(([result]) => result) as Promise<T[]>;

	async function getSchema(tx?: TTransaction) {
		const q = tx ? tx.query : query;
		const tbls = await q({
			params: [],
			sql: "SELECT name FROM sqlite_master WHERE type = 'table';"
		}).then((rows) => rows.map((row) => row.name));
		const schema = new Map(
			await Promise.all(
				tbls.map(async (tbl) => {
					const cols = await q({ params: [], sql: `PRAGMA table_info("${tbl}");` }).then((rows) =>
						rows.map((row) => row.name)
					);
					return [tbl as string, new Set(cols as string[])] as const;
				})
			)
		);
		return schema;
	}
	const subscriptions = new Map<
		string,
		Set<{
			handler: (data: unknown, timestamp: string, version: string) => unknown;
			self?: boolean;
		}>
	>();

	const logger = {
		applyUpdates: async (updates: TUpdate[], timestamp: string, tx: TTransaction) => {
			if (updates.length === 0) return;
			const schema = await getSchema(tx);
			for (const update of updates) {
				try {
					if (update.operation === 'insert') {
						await tx.query(convertUpdateToStatement(update, timestamp, schema));
						await processPendingEvents(update.id, update.table, tx, schema);
					} else if (update.operation === 'update' || update.operation === 'delete') {
						const exists = await checkRecordExists(update.table, update.id, tx, schema);
						if (!exists) {
							await storePendingEvent(update, timestamp, tx);
						} else {
							await tx.query(convertUpdateToStatement(update, timestamp, schema));
						}
					} else {
						await tx.query(convertUpdateToStatement(update, timestamp, schema));
					}
				} catch (error) {
					throw new Error(`Failed to apply update: ${JSON.stringify(update)}`, { cause: error });
				}
			}
		},
		dispatch: async (...events: Array<TEvent & { dontLog?: boolean }>) => {
			if (events.length === 0) return;
			if (validateEvent) {
				for (let i = 0; i < events.length; i++) {
					const event = events[i];
					try {
						const validatedEvent = validateEvent(event);
						events[i] = validatedEvent;
					} catch (error) {
						throw new Error(`Invalid event: ${JSON.stringify(event)}`, { cause: error });
					}
				}
			}
			const clock = await logger.getClock();
			const version = await logger.getVersion();
			if (!version) throw new Error('Version not set');

			let updates: Array<{
				event: TEvent & { timestamp: string; version: string };
				updates: TUpdate[];
			}> = [];
			const loggedEvents = await db.transaction(async (tx) => {
				const enhancedEvents = [];
				for (const event of events)
					enhancedEvents.push({ ...event, timestamp: clock.increment().toString(), version });

				updates = (
					await Promise.all(
						enhancedEvents.map(async (event) => ({
							event: event,
							updates: await eventToUpdates(event, tx)
						}))
					)
				).flat();
				const validatedEventsToLog = enhancedEvents.filter(
					(event) => !('dontLog' in event) || !event.dontLog
				);
				let loggedEvents:
					| Array<{ data: string; timestamp: string; type: string; version: string }>
					| undefined;
				if (validatedEventsToLog.length > 0) {
					loggedEvents = await tx.query({
						params: validatedEventsToLog
							.values()
							.flatMap((event) => [event.timestamp, event.type, event.data, event.version])
							.map(toSql)
							.toArray(),
						sql: `INSERT OR IGNORE INTO events (timestamp, type, data, version) VALUES ${validatedEventsToLog
							.map(() => '(?, ?, ?, ?)')
							.join(',')} RETURNING timestamp, type, data, version`
					});
				}
				await logger.setClock(clock, tx);
				await Promise.all(
					updates.map(({ event, updates }) => logger.applyUpdates(updates, event.timestamp, tx))
				);
				return loggedEvents;
			});
			if (loggedEvents) {
				for (const { data, timestamp, type, version } of loggedEvents) {
					const subscribers = subscriptions.get(type);
					if (!subscribers) continue;
					for (const subscriber of subscribers) {
						if (!subscriber.self) continue;
						subscriber.handler(JSON.parse(data), timestamp, version);
					}
				}
			}
			await invalidate?.(
				updates.map(({ event, updates }) => ({
					event,
					keys: updates.flatMap((update) => update.invalidate ?? [])
				}))
			);
			onNewEvent?.();
		},
		getClientId: async (tx?: TTransaction): Promise<string> => {
			const _query = tx ? tx.query : query;
			return await _query<{ value: string }>({
				params: [],
				sql: "SELECT value FROM metadata WHERE key = 'clientId'"
			}).then((rows) => rows[0]!.value);
		},
		getClock: async (tx?: TTransaction): Promise<HLC> => {
			const _query = tx ? tx.query : query;
			return HLC.fromString(
				await _query<{ value: string }>({
					params: [],
					sql: "SELECT value FROM metadata WHERE key = 'clock'"
				}).then((rows) => {
					return rows[0]!.value;
				})
			);
		},
		getLatestReceivedAt: async (sourceId: string) => {
			const result = await query<{ latest_received: string }>({
				params: [sourceId],
				sql: `SELECT latest_received FROM sync_state WHERE sourceId = ?`
			});
			return result[0]?.latest_received ?? '0';
		},
		getLatestSentAt: async (sourceId: string) => {
			const result = await query<{ latest_sent: string }>({
				params: [sourceId],
				sql: `SELECT latest_sent FROM sync_state WHERE sourceId = ?`
			});
			return result[0]?.latest_sent ?? '0';
		},
		getMetadata: async (key: string) => {
			return await query<{ value: string }>({
				params: [key],
				sql: `SELECT value FROM metadata WHERE key = ?`
			}).then((rows) => rows[0]?.value ?? null);
		},
		getUnsyncedEvents: async (sourceId: string, limit: number = 100) => {
			const clientId = await logger.getClientId();
			const latestSentAt = await logger.getLatestSentAt(sourceId);
			const events = await query<TEvent & { timestamp: string; version: string }>({
				params: [latestSentAt, `%${clientId}`, limit + 1],
				sql: `SELECT timestamp, type, data, version FROM events WHERE timestamp > ? AND timestamp LIKE ? ORDER BY timestamp ASC LIMIT ?`
			});
			for (let i = 0; i < events.length; i++)
				events[i]!.data = JSON.parse(events[i]!.data as string);

			const hasMore = events.length > limit;
			if (hasMore) events.pop();
			return { events, hasMore };
		},
		getVersion: async (tx?: TTransaction) => {
			const _query = tx ? tx.query : query;
			return await _query<{ value: string }>({
				params: [],
				sql: "SELECT value FROM metadata WHERE key = 'version'"
			}).then((rows) => rows[0]?.value);
		},
		on(
			type: TEvent['type'],
			handler: (data: TEvent['data'], timestamp: string) => void,
			opts?: { self?: boolean }
		) {
			const subscribers = subscriptions.get(type) ?? new Set();
			const subscriber = opts?.self ? { handler, self: opts.self } : { handler };
			subscribers.add(subscriber);
			subscriptions.set(type, subscribers);
			return () => {
				const subscribers = subscriptions.get(type)!;
				subscribers.delete(subscriber);
			};
		},
		receive: async (
			sourceId: string,
			events: Array<TEvent & { syncedAt: string; timestamp: string; version: string }>,
			tx?: TTransaction
		): Promise<() => Promise<void>> => {
			if (!tx) return await db.transaction((tx) => logger.receive(sourceId, events, tx));
			const version = await logger.getVersion(tx);
			if (version === undefined) throw new Error('Version not set');
			let futureEvents: Array<TEvent & { syncedAt: string; timestamp: string }>;
			[events, futureEvents] = partitionArray(events, (event) => event.version <= version);
			if (events.length === 0) return async () => {};
			if (validateEvent) {
				for (let i = 0; i < events.length; i++) {
					const event = events[i]!;
					try {
						const validatedEvent = validateEvent(event);
						events[i] = Object.assign(validatedEvent, {
							syncedAt: event.syncedAt,
							timestamp: event.timestamp,
							version: event.version
						});
					} catch (error) {
						throw new Error(`Invalid event: ${JSON.stringify(event)}`, { cause: error });
					}
				}
			}
			await Promise.all(
				futureEvents.map((event) =>
					tx.query({
						params: [sourceId, event.syncedAt],
						sql: `INSERT OR IGNORE INTO sync_state_missing (sourceId, timestamp) VALUES (?, ?)`
					})
				)
			);
			const clock = await logger.getClock(tx);
			let updates: Array<{
				event: TEvent & { syncedAt: string; timestamp: string; version: string };
				updates: TUpdate[];
			}> = [];
			const loggedEvents = await tx.query({
				params: events
					.values()
					.flatMap((event) => [event.timestamp, event.type, event.data, event.version])
					.map(toSql)
					.toArray(),
				sql: `INSERT OR IGNORE INTO events (timestamp, type, data, version) VALUES ${events
					.map(() => '(?, ?, ?, ?)')
					.join(',')} RETURNING timestamp, type, data, version`
			});
			updates = await Promise.all(
				events.map(async (event) => {
					return { event, updates: await eventToUpdates(event, tx) };
				})
			);
			for (const { event, updates: _updates } of updates) {
				try {
					await logger.applyUpdates(_updates, event.timestamp, tx);
				} catch (error) {
					await tx.query({
						params: [sourceId, event.syncedAt],
						sql: `INSERT OR IGNORE INTO sync_state_missing (sourceId, timestamp) VALUES (?, ?)`
					});
					console.error('Failed to apply update', error);
				}
				clock.receive(event.timestamp);
			}

			await logger.setClock(clock, tx);
			const latestReceivedAt = clock.toString();
			await tx.query({
				params: [sourceId, latestReceivedAt, latestReceivedAt],
				sql: `INSERT INTO sync_state (sourceId, latest_received) VALUES (?, ?) ON CONFLICT(sourceId) DO UPDATE SET latest_received = ?`
			});
			const tasks = [] as Promise<unknown>[];
			for (const { data, timestamp, type, version } of loggedEvents) {
				const subscribers = subscriptions.get(type);
				if (!subscribers) continue;
				for (const subscriber of subscribers)
					tasks.push(Promise.resolve(subscriber.handler(JSON.parse(data), timestamp, version)));
			}
			await Promise.all(tasks);
			return async () =>
				invalidate?.(
					updates.map(({ event, updates }) => ({
						event,
						keys: updates.flatMap((update) => update.invalidate ?? [])
					}))
				);
		},
		setClock: async (clock: HLC, tx: TTransaction) => {
			await tx.query({
				params: [clock.toString()],
				sql: `UPDATE metadata SET value = ? WHERE key = 'clock'`
			});
		},
		setLatestSentAt: async (sourceId: string, timestamp: string) => {
			await query({
				params: [sourceId, timestamp, timestamp, timestamp],
				sql: `INSERT INTO sync_state (sourceId, latest_sent) VALUES (?, ?) ON CONFLICT(sourceId) DO UPDATE SET latest_sent = ? WHERE latest_sent < ? OR latest_sent IS NULL`
			});
		},
		setMetadata: async (key: string, value: string) => {
			if (['clientId', 'clock', 'version'].includes(key))
				throw new Error(`not allowed to manually set metadata key: ${key}`);
			await query({
				params: [key, value, value],
				sql: `INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`
			});
		},
		setVersion: async (version: string, tx?: TTransaction) => {
			const q = tx ? tx.query : query;
			await q({
				params: [version, version],
				sql: `INSERT INTO metadata (key, value) VALUES ('version', ?) ON CONFLICT(key) DO UPDATE SET value = ?`
			});
		}
	};

	return {
		db,
		// TOOD: figure out typescript here
		dispatch: logger.dispatch as never,
		getClientId: logger.getClientId,
		getClock: logger.getClock,
		getLatestReceivedAt: logger.getLatestReceivedAt,
		getLatestSentAt: logger.getLatestSentAt,
		getMetadata: logger.getMetadata,
		getUnsyncedEvents: logger.getUnsyncedEvents,
		getVersion: logger.getVersion,
		on: logger.on,
		receive: logger.receive,
		setLatestSentAt: logger.setLatestSentAt,
		setMetadata: logger.setMetadata,
		setVersion: logger.setVersion
	};
}

const toSql = (value: unknown) => {
	switch (typeof value) {
		case 'boolean':
			return value ? 1 : 0;
		case 'number':
			return value;
		case 'object':
			if (value === null) return null;
			return JSON.stringify(value);
		case 'string':
			return value;
		default:
			throw new Error(`Invalid sql value: ${value}`);
	}
};

async function checkRecordExists(
	tableName: string,
	id: string,
	tx: TTransaction,
	schema: Map<string, Set<string>>
): Promise<boolean> {
	if (!schema.has(tableName)) return false;
	const result = await tx.query<{ cnt: number }>({
		params: [id],
		sql: `SELECT COUNT(1) as cnt FROM "${tableName}" WHERE "id" = ?`
	});
	return result[0]!.cnt > 0;
}

function convertUpdateToStatement(
	update: TUpdate,
	timestamp: string,
	schema: Map<string, Set<string>>
): { params: unknown[]; sql: string } {
	const tableName = update.table;
	if (!schema.has(update.table)) throw new Error(`Table ${update.table} not found`);
	const tableColumns = schema.get(update.table)!;
	const columns =
		update.operation !== 'delete' ?
			Object.keys(update.data).filter(
				(column) =>
					tableColumns.has(column) &&
					!['createdAt', 'id', 'updatedAt'].includes(column) &&
					update.data[column] !== undefined
			)
		:	[];

	const id = update.id;

	switch (update.operation) {
		case 'delete': {
			return { params: [id], sql: `DELETE FROM "${tableName}" WHERE "id" = ?` };
		}
		case 'insert': {
			const values = columns.map((column) => update.data[column]);
			return {
				params: [id, ...values, timestamp, {}].map((value) => toSql(value)),
				sql: `
              INSERT OR IGNORE INTO "${tableName}"(
                "id",
                ${columns.map((column) => `"${column}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columns.map(() => '?').join(',')},
                ?, 
                ?
              )`
			};
		}
		case 'update': {
			return {
				params: [
					...columns.flatMap((col) => [timestamp, update.data[col]]),
					...columns.map(() => timestamp),
					id
				].map(toSql),
				sql: `
              UPDATE "${tableName}"
              SET
                ${columns
									.map(
										(column) => `
                      "${column}" = CASE
                          WHEN json_extract(updatedAt, '$.${column}') IS NULL
                               OR json_extract(updatedAt, '$.${column}') < ?
                          THEN ?
                          ELSE "${column}"
                      END
                    `
									)
									.join(',')},
                updatedAt = json_set(
                  updatedAt,
                  ${columns.map((column) => `'$.${column}', ?`).join(', ')}
                )
              WHERE "id" = ?
            `
			};
		}
		case 'upsert': {
			const insertSql = `
              INSERT INTO "${tableName}"(
                "id",
                ${columns.map((column) => `"${column}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columns.map(() => '?').join(',')},
                ?, 
                ?
              )
            `;

			const updateSql = `
              SET
                ${columns
									.map(
										(column) => `
                      "${column}" = CASE
                        WHEN json_extract(updatedAt, '$.${column}') IS NULL
                             OR json_extract(updatedAt, '$.${column}') < ?
                        THEN ?
                        ELSE "${column}"
                      END
                    `
									)
									.join(',')},
                updatedAt = json_set(
                  updatedAt,
                  ${columns.map((column) => `'$.${column}', ?`).join(', ')}
                )
            `;

			const upsertSql = `
              ${insertSql}
              ON CONFLICT("id") DO UPDATE
              ${updateSql}
            `;

			const insertParams = [
				id,
				...columns.map((c) => update.data[c]),
				timestamp,
				Object.fromEntries(columns.map((c) => [c, timestamp]))
			].map(toSql);

			const updateParams = [
				...columns.flatMap((c) => [timestamp, update.data[c]]),
				...columns.map(() => timestamp)
			].map(toSql);

			const params = [...insertParams, ...updateParams];

			return { params, sql: upsertSql };
		}
	}
}

function partitionArray<T, U extends T>(
	array: T[],
	predicate: (value: T) => value is U
): [U[], Exclude<T, U>[]];
function partitionArray<T>(array: T[], predicate: (value: T) => boolean): [T[], T[]];
function partitionArray<T>(array: T[], predicate: (value: T) => boolean): [T[], T[]] {
	const trueArray: T[] = [];
	const falseArray: T[] = [];

	for (const value of array) {
		if (predicate(value)) {
			trueArray.push(value);
		} else {
			falseArray.push(value);
		}
	}

	return [trueArray, falseArray];
}
async function processPendingEvents(
	id: string,
	tableName: string,
	tx: TTransaction,
	schema: Map<string, Set<string>>
): Promise<void> {
	const pendingEvents = await tx
		.query<{
			data: string;
			id: string;
			operation: 'delete' | 'insert' | 'update' | 'upsert';
			table: string;
			timestamp: string;
		}>({
			params: [id, tableName],
			sql: `SELECT id, "table", timestamp, data, operation FROM pendingEvents WHERE id = ? AND "table" = ? ORDER BY timestamp ASC`
		})
		.then((rows) => rows.map((row) => Object.assign(row, { data: JSON.parse(row.data) })));

	const deleteEventIndex = pendingEvents.findIndex((event) => event.operation === 'delete');
	if (deleteEventIndex > -1) {
		const deleteEvent = pendingEvents[deleteEventIndex]!;
		await tx.query(convertUpdateToStatement(deleteEvent, deleteEvent.timestamp, schema));
	} else {
		for (const event of pendingEvents)
			await tx.query(convertUpdateToStatement(event, event.timestamp, schema));
	}

	if (pendingEvents.length > 0) {
		await tx.query({
			params: [id, tableName],
			sql: `DELETE FROM pendingEvents WHERE id = ? AND "table" = ?`
		});
	}
}
async function storePendingEvent(
	update: TUpdate,
	timestamp: string,
	tx: TTransaction
): Promise<void> {
	const data = 'data' in update ? update.data : {};
	await tx.query({
		params: [update.id, update.table, timestamp, JSON.stringify(data), update.operation],
		sql: `INSERT OR REPLACE INTO pendingEvents (id, "table", timestamp, data, operation) VALUES (?, ?, ?, ?, ?)`
	});
}
