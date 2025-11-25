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
	dispatch: (...events: Array<T & { dontLog?: boolean }>) => Promise<void>;
	getClientId: () => Promise<string>;
	getClock: () => Promise<HLC>;
	getMetadata: (key: string) => Promise<null | string>;
	on: <U extends T>(
		type: U['type'],
		handler: (data: U['data'], timestamp: string) => void,
		opts?: { self?: boolean }
	) => () => void;
	receive: (
		events: Array<T & { syncedAt: string; timestamp: string }>,
		tx?: TTransaction
	) => Promise<string[][]>;
	setMetadata: (key: string, value: string) => Promise<void>;
}

type MaybePromise<T> = Promise<T> | T;
type TBaseEvent = {
	data: unknown;
	type: string;
};

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
			sql`INSERT INTO \`metadata\` (\`key\`, \`value\`) VALUES ('clock', ${newClock.toString()}) ON CONFLICT DO NOTHING;`,
			sql`INSERT INTO \`metadata\` (\`key\`, \`value\`) VALUES ('clientId', ${newClock.clientId}) ON CONFLICT DO NOTHING;`,
			...(config.onInit?.(sql) ?? [])
		]
	});
	const query = <T extends Record<string, unknown>>(query: { params: unknown[]; sql: string }) =>
		db.batch(() => [query]).then(([result]) => result) as Promise<T[]>;

	const tbls = await query({
		params: [],
		sql: "SELECT name FROM sqlite_master WHERE type = 'table';"
	}).then((rows) => rows.map((row) => row.name));
	const schema = new Map(
		await Promise.all(
			tbls.map(async (tbl) => {
				const cols = await query({ params: [], sql: `PRAGMA table_info("${tbl}");` }).then((rows) =>
					rows.map((row) => row.name)
				);
				return [tbl as string, new Set(cols as string[])] as const;
			})
		)
	);
	const subscriptions = new Map<
		string,
		Set<{ handler: (data: unknown, timestamp: string) => unknown; self?: boolean }>
	>();

	const logger = {
		applyUpdates: async (updates: TUpdate[], timestamp: string, tx: TTransaction) => {
			if (updates.length === 0) return;
			await Promise.all(
				updates.map((update) =>
					tx.query(updateToStatement(update, timestamp, schema)).catch((error) => {
						throw new Error(`Failed to apply update: ${JSON.stringify(update)}`, { cause: error });
					})
				)
			);
		},
		dispatch: async (...events: Array<TEvent & { dontLog?: boolean; timestamp?: string }>) => {
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

			let updates: TUpdate[] = [];
			const loggedEvents = await db.transaction(async (tx) => {
				updates = (await Promise.all(events.map((event) => eventToUpdates(event, tx)))).flat();
				for (const event of events) {
					event.timestamp = clock.increment().toString();
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
		getMetadata: async (key: string) => {
			return await query<{ value: string }>({
				params: [key],
				sql: `SELECT value FROM metadata WHERE key = ?`
			}).then((rows) => rows[0]?.value ?? null);
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
			events: Array<TEvent & { syncedAt: string; timestamp: string }>,
			tx?: TTransaction
		): Promise<string[][]> => {
			if (events.length === 0) return [];
			if (validateEvent) {
				for (let i = 0; i < events.length; i++) {
					const event = events[i];
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
			if (!tx) return await db.transaction((tx) => logger.receive(events, tx));

			const clock = await logger.getClock(tx);

			let updates: Array<{
				event: TEvent & { syncedAt: string; timestamp: string };
				updates: TUpdate[];
			}> = [];
			const loggedEvents = await tx.query({
				params: events
					.values()
					.flatMap((event) => [event.timestamp, event.type, event.type])
					.map(toSql)
					.toArray(),
				sql: `INSERT INTO events (timestamp, type, data) VALUES ${events
					.map(() => '(?, ?, ?)')
					.join(',')} ON CONFLICT DO NOTHING`
			});
			updates = await Promise.all(
				events.map(async (event) => {
					return {
						event,
						updates: await eventToUpdates(event, tx)
					};
				})
			);
			for (const { event, updates: _updates } of updates) {
				await logger.applyUpdates(_updates, event.timestamp, tx);
				clock.receive(event.timestamp);
			}

			await logger.setClock(clock, tx);
			const lastPullAt = clock.toString();
			await tx.query({
				params: [lastPullAt, lastPullAt],
				sql: `INSERT INTO metadata (key, value) VALUES ('lastPullAt', ?) ON CONFLICT(key) DO UPDATE SET value = ?`
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
		setMetadata: async (key: string, value: string) => {
			if (key === 'clock' || key === 'clientId')
				throw new Error(`not allowed to manually set metadata key: ${key}`);
			await query({
				params: [key, value, value],
				sql: `INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?`
			});
		}
	};

	return {
		db,
		dispatch: logger.dispatch,
		getClientId: logger.getClientId,
		getClock: logger.getClock,
		getMetadata: logger.getMetadata,
		on: logger.on,
		receive: logger.receive,
		setMetadata: logger.setMetadata
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
              INSERT INTO "${tableName}"(
                "id",
                ${columns.map((column) => `"${column}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columns.map(() => '?').join(',')},
                ?, ?
              )
              ON CONFLICT("id") DO NOTHING`
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
