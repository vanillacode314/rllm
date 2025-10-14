import { HLC } from 'hlc';
import { type ClientConfig, SQLocal, type Transaction } from 'sqlocal';

export type TConfig<TEvent extends TBaseEvent> = {
	config: ClientConfig;
	eventToUpdates: (event: NoInfer<TEvent>, tx: TTransaction) => MaybePromise<TUpdate[]>;
	invalidate?: (keys: string[][]) => MaybePromise<void>;
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
		...events: Array<T & { dontLog?: boolean; timestamp?: string; version?: string }>
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
	on: <U extends T>(
		type: U['type'],
		handler: (data: U['data'], timestamp: string) => void,
		opts?: { self?: boolean }
	) => () => void;
	receive: (
		sourceId: string,
		events: Array<T & { syncedAt: string; timestamp: string }>,
		tx?: TTransaction
	) => Promise<string[][]>;
	setLatestSentAt: (sourceId: string, timestamp: string) => Promise<void>;
	setMetadata: (key: string, value: string) => Promise<void>;
	setVersion: (version: string, tx?: TTransaction) => Promise<void>;
}
type MaybePromise<T> = Promise<T> | T;
type TBaseEvent = { data: unknown; timestamp: string; type: string; version: string };

type TTransaction = Pick<Transaction, 'query'>;

export async function createEventLogger<TEvent extends TBaseEvent>({
	config,
	eventToUpdates,
	invalidate,
	onNewEvent,
	validateEvent
}: TConfig<TEvent>): Promise<Logger<TEvent>> {
	console.error('FIX SCHEMA VERSIONING');
	const newClock = HLC.generate();
	const db = new SQLocal({
		...config,
		onInit: (sql) => [
			sql`PRAGMA journal_mode=MEMORY;`,
			sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` text PRIMARY KEY NOT NULL, \`value\` text NOT NULL);`,
			sql`INSERT OR IGNORE INTO \`metadata\` (\`key\`, \`value\`) VALUES ('clock', ${newClock.toString()}), ('clientId', ${newClock.clientId});`,
			// sql`CREATE TABLE IF NOT EXISTS \`events\` (\`timestamp\` text PRIMARY KEY NOT NULL, \`type\` text NOT NULL, \`data\` text NOT NULL, \`version\` text NOT NULL);`,
			sql`CREATE TABLE IF NOT EXISTS \`sync_state\` (\`sourceId\` text PRIMARY KEY NOT NULL, \`latest_received\` text, \`latest_sent\` text);`,
			sql`CREATE TABLE IF NOT EXISTS \`sync_state_missing\` (\`sourceId\` text NOT NULL, \`timestamp\` text NOT NULL, PRIMARY KEY (\`sourceId\`, \`timestamp\`));`,
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
		Set<{ handler: (data: unknown, timestamp: string) => unknown; self?: boolean }>
	>();

	const logger = {
		applyUpdates: async (updates: TUpdate[], timestamp: string, tx: TTransaction) => {
			if (updates.length === 0) return;
			const schema = await getSchema(tx);
			await Promise.all(
				updates.map((update) =>
					tx.query(updateToStatement(update, timestamp, schema)).catch((error) => {
						throw new Error(`Failed to apply update: ${JSON.stringify(update)}`, { cause: error });
					})
				)
			);
		},
		dispatch: async (
			...events: Array<TEvent & { dontLog?: boolean; timestamp?: string; version?: string }>
		) => {
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

			let updates: TUpdate[] = [];
			const loggedEvents = await db.transaction(async (tx) => {
				updates = (await Promise.all(events.map((event) => eventToUpdates(event, tx)))).flat();
				for (const event of events) {
					Object.assign(event, {
						timestamp: clock.increment().toString(),
						version
					});
				}
				const validatedEventsToLog = events.filter(
					(event) => !('dontLog' in event) || !event.dontLog
				);
				let loggedEvents: Array<{ timestamp: string }> | undefined;
				if (validatedEventsToLog.length > 0) {
					loggedEvents = await tx.query({
						params: validatedEventsToLog
							.values()
							.flatMap((event) => [event.timestamp, event.type, event.data])
							.map(toSql)
							.toArray(),
						sql: `INSERT OR IGNORE INTO events (timestamp, type, data) VALUES ${validatedEventsToLog
							.map(() => '(?, ?, ?)')
							.join(',')} RETURNING timestamp`
					});
				}
				await logger.setClock(clock, tx);
				await logger.applyUpdates(updates, clock.toString(), tx);
				return loggedEvents;
			});
			if (loggedEvents) {
				for (const { timestamp } of loggedEvents) {
					const event = events.find((event) => event.timestamp === timestamp)!;
					const subscribers = subscriptions.get(event.type);
					if (!subscribers) continue;
					for (const subscriber of subscribers) {
						if (!subscriber.self) continue;
						subscriber.handler(event.data, timestamp);
					}
				}
			}
			await invalidate?.(updates.flatMap((update) => update.invalidate ?? []));
			onNewEvent?.();
		},
		getClientId: async (tx?: TTransaction): Promise<string> => {
			const _query = tx ? tx.query : query;
			return await Promise.resolve(
				_query<{ value: string }>({
					params: [],
					sql: "SELECT value FROM metadata WHERE key = 'clientId'"
				})
			).then((rows) => rows[0]!.value);
		},
		getClock: async (tx?: TTransaction): Promise<HLC> => {
			const _query = tx ? tx.query : query;
			return HLC.fromString(
				await Promise.resolve(
					_query<{ value: string }>({
						params: [],
						sql: "SELECT value FROM metadata WHERE key = 'clock'"
					})
				).then((rows) => {
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
			const events = await query<TEvent>({
				params: [latestSentAt, limit + 1],
				sql: `SELECT timestamp, type, data FROM events WHERE timestamp > ? AND timestamp LIKE '%${clientId}' ORDER BY timestamp ASC LIMIT ?`
			});
			for (let i = 0; i < events.length; i++) {
				events[i]!.data = JSON.parse(events[i]!.data as string);
			}
			const hasMore = events.length > limit;
			if (hasMore) events.pop();
			return { events, hasMore };
		},
		getVersion: async (tx?: TTransaction) => {
			const _query = tx ? tx.query : query;
			return await Promise.resolve(
				_query<{ value: string }>({
					params: [],
					sql: "SELECT value FROM metadata WHERE key = 'version'"
				})
			).then((rows) => rows[0]?.value);
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
			events: Array<TEvent & { syncedAt: string; timestamp: string }>,
			tx?: TTransaction
		): Promise<string[][]> => {
			const version = await logger.getVersion(tx);
			if (version === undefined) throw new Error('Version not set');
			let futureEvents: Array<TEvent & { syncedAt: string; timestamp: string }>;
			[events, futureEvents] = partitionArray(events, (event) => event.version <= version);
			if (events.length === 0) return [];
			if (validateEvent) {
				for (let i = 0; i < events.length; i++) {
					const event = events[i]!;
					try {
						const validatedEvent = validateEvent(event);
						events[i] = Object.assign(validatedEvent, {
							syncedAt: event.syncedAt,
							timestamp: event.timestamp
						});
					} catch (error) {
						throw new Error(`Invalid event: ${JSON.stringify(event)}`, { cause: error });
					}
				}
			}
			if (!tx) return await db.transaction((tx) => logger.receive(sourceId, events, tx));
			await Promise.all(
				futureEvents.map((event) =>
					tx.query({
						params: [sourceId, event.timestamp],
						sql: `INSERT OR IGNORE INTO sync_state_missing (sourceId, timestamp) VALUES (?, ?)`
					})
				)
			);
			const clock = await logger.getClock(tx);
			let updates: Array<{
				event: TEvent & { syncedAt: string; timestamp: string };
				updates: TUpdate[];
			}> = [];
			const loggedEvents = await tx.query({
				params: events
					.values()
					.flatMap((event) => [event.timestamp, event.type, event.data])
					.map(toSql)
					.toArray(),
				sql: `INSERT OR IGNORE INTO events (timestamp, type, data) VALUES ${events
					.map(() => '(?, ?, ?)')
					.join(',')}`
			});
			updates = await Promise.all(
				events.map(async (event) => {
					return { event, updates: await eventToUpdates(event, tx) };
				})
			);
			for (const { event, updates: _updates } of updates) {
				try {
					await logger.applyUpdates(_updates, event.timestamp, tx);
					clock.receive(event.timestamp);
				} catch (error) {
					await tx.query({
						params: [sourceId, event.timestamp],
						sql: `INSERT OR IGNORE INTO sync_state_missing (sourceId, timestamp) VALUES (?, ?)`
					});
					console.error('Failed to apply update', error);
				}
			}

			await logger.setClock(clock, tx);
			const latestReceivedAt = clock.toString();
			await tx.query({
				params: [sourceId, latestReceivedAt, latestReceivedAt],
				sql: `INSERT INTO sync_state (sourceId, latest_received) VALUES (?, ?) ON CONFLICT(sourceId) DO UPDATE SET latest_received = ?`
			});
			for (const { timestamp } of loggedEvents) {
				const event = events.find((event) => event.timestamp === timestamp)!;
				const subscribers = subscriptions.get(event.type);
				if (!subscribers) continue;
				for (const subscriber of subscribers) subscriber.handler(event.data, timestamp);
			}
			return updates
				.flatMap((update) => update.updates)
				.flatMap((update) => update.invalidate ?? []);
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
		dispatch: logger.dispatch,
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
function updateToStatement(
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
				(column) => tableColumns.has(column) && column !== 'id' && update.data[column] !== undefined
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
				params: [
					id,
					...values,
					timestamp,
					Object.fromEntries(columns.map((column) => [column, timestamp]))
				].map((value) => toSql(value)),
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
                ?, ?
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
                ${columns.map((c) => `"${c}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columns.map(() => '?').join(',')},
                ?, ?
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
