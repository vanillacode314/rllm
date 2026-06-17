// oxlint-disable no-await-in-loop
import { HLC } from 'hlc';
import { MerkleTree, stringHasher } from 'merkle-tree';

export type TConfig<TEvent extends Omit<TBaseEvent, 'timestamp' | 'version'>> = {
  db: TSqlDB;
  eventToUpdates: TEventTransformer<TEvent>;
  invalidate?: (
    items: Array<{
      event: NoInfer<TEvent & { timestamp: string; version: string }>;
      keys: string[][];
    }>
  ) => MaybePromise<void>;
  validateEvent?: (event: unknown) => TEvent;
};

export type TEventTransformer<TEvent = TBaseEvent> = (
  event: NoInfer<TEvent & { timestamp: string; version: string }>,
  tx: TSqlRunner
) => MaybePromise<TUpdate[]>;

export interface TSqlDB extends TSqlRunner {
  transaction<T>(callback: (tx: TSqlRunner) => Promise<T>): Promise<T>;
}

export interface TSqlRunner {
  batch(statements: TStatement[]): Promise<void>;
  query<T extends Record<string, unknown>>(statement: TStatement): Promise<T[]>;
}

export type TStatement = {
  params: unknown[];
  sql: string;
};
export type TUpdate =
  | {
      creates: boolean;
      id: string;
      invalidate?: Array<string[]>;
      operation: 'sql';
      statements: Record<
        string,
        Array<{ executeEvenIfTimestampIsOlder?: boolean; params: unknown[]; sql: string }>
      >;
      table: string;
    }
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
  clearMetadata: (key: string, tx?: TSqlRunner) => Promise<void>;
  db: TSqlDB;
  dispatch: (
    ...events: Array<
      Omit<T, 'timestamp' | 'version'> & { dontLog?: boolean; timestamp?: string; version?: string }
    >
  ) => Promise<void>;
  getClientId: () => Promise<string>;
  getClock: () => Promise<HLC>;
  getMerkleTree: () => Promise<MerkleTree<string, string>>;
  getMetadata: (key: string) => Promise<null | string>;
  getVersion: () => Promise<string | undefined>;
  on: <
    U extends T,
    TType extends '*' | U['type'],
    TData = TType extends '*' ? unknown : (U & { type: TType })['data']
  >(
    type: TType,
    handler: (data: TData, timestamp: string, version: string, type: string) => void,
    opts?: { remote?: boolean; self?: boolean }
  ) => () => void;
  receive: (events: Array<T>, tx?: TSqlRunner) => Promise<() => Promise<void>>;
  setMetadata: (key: string, value: string) => Promise<void>;
  setVersion: (version: string, tx?: TSqlRunner) => Promise<void>;
  sql: typeof sql;
}

type MaybePromise<T> = Promise<T> | T;

type TBaseEvent = { data: unknown; timestamp: string; type: string; version: string };

export async function createEventLogger<TEvent extends Omit<TBaseEvent, 'timestamp' | 'version'>>({
  db,
  eventToUpdates,
  invalidate,
  validateEvent
}: TConfig<TEvent>): Promise<Logger<TEvent & { timestamp: string; version: string }>> {
  const newClock = HLC.generate();
  await db.batch([
    sql`CREATE TABLE IF NOT EXISTS \`metadata\` ( \`key\` text PRIMARY KEY NOT NULL, \`value\` text NOT NULL);`,
    sql`INSERT OR IGNORE INTO \`metadata\` (\`key\`, \`value\`) VALUES ('clock', ${newClock.toString()}), ('clientId', ${newClock.clientId});`,
    sql`CREATE TABLE IF NOT EXISTS \`events\` (\`timestamp\` text PRIMARY KEY NOT NULL, \`type\` text NOT NULL, \`data\` text NOT NULL, \`version\` text NOT NULL);`,
    sql`CREATE TABLE IF NOT EXISTS \`pendingEvents\` (\`id\` text NOT NULL, \`table\` text NOT NULL, \`timestamp\` text NOT NULL, \`data\` text NOT NULL, \`operation\` text NOT NULL, PRIMARY KEY (\`id\`, \`table\`, \`timestamp\`));`
  ]);

  await migratePendingEventsStatements(db);

  async function getSchema(tx: TSqlRunner = db) {
    const tbls = await tx
      .query<{ name: string }>({
        params: [],
        sql: "SELECT name FROM sqlite_master WHERE type = 'table';"
      })
      .then((rows) => rows.map((row) => row.name));
    const schema = new Map(
      await Promise.all(
        tbls.map(async (tbl) => {
          const cols = await tx
            .query<{ name: string }>({ params: [], sql: `PRAGMA table_info("${tbl}");` })
            .then((rows) => rows.map((row) => row.name));
          return [tbl as string, new Set(cols as string[])] as const;
        })
      )
    );
    return schema;
  }

  const subscriptions = new Map<
    string,
    Set<{
      handler: (data: unknown, timestamp: string, version: string, type: string) => unknown;
      remote: boolean;
      self: boolean;
    }>
  >();

  const logger = {
    applyUpdates: async (updates: TUpdate[], timestamp: string, tx: TSqlRunner) => {
      if (updates.length === 0) return;
      const schema = await getSchema(tx);
      for (const update of updates) {
        const statements = await convertUpdateToStatement(update, timestamp, schema, tx);
        if (statements === null) continue;
        try {
          if (update.operation === 'insert' || (update.operation === 'sql' && update.creates)) {
            await tx.batch(statements);
            await processPendingEvents(update.id, update.table, tx, schema);
          } else if (
            update.operation === 'update' ||
            update.operation === 'delete' ||
            (update.operation === 'sql' && !update.creates)
          ) {
            const exists = await checkRecordExists(update.table, update.id, tx, schema);
            if (!exists) {
              await storePendingEvent(update, timestamp, tx);
            } else {
              await tx.batch(statements);
            }
          } else {
            await tx.batch(statements);
          }
        } catch (error) {
          console.debug(`Failed to apply update`, statements, update);
          console.error(error);
          throw new Error(`Failed to apply update`, { cause: error });
        }
      }
    },
    clearMetadata: async (key: string, tx: TSqlRunner = db) => {
      await tx.query(sql`DELETE FROM metadata WHERE key = ${key}`);
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
        if (loggedEvents) {
          const tree = await logger.getMerkleTree(tx);
          tree.insert(
            loggedEvents.map((event) => ({ meta: event.timestamp, value: event.timestamp }))
          );
          await logger.persistMerkleTree(tree, tx);
        }
        return loggedEvents;
      });
      if (loggedEvents) {
        for (const { data, timestamp, type, version } of loggedEvents) {
          const blanketSubscribers = subscriptions.get('*');
          const eventSubscribers = subscriptions.get(type);
          let subscribers = new Set<{
            handler: (data: unknown, timestamp: string, version: string, type: string) => unknown;
            remote: boolean;
            self: boolean;
          }>();
          if (blanketSubscribers) subscribers = subscribers.union(blanketSubscribers);
          if (eventSubscribers) subscribers = subscribers.union(eventSubscribers);
          for (const subscriber of subscribers) {
            if (!subscriber.self) continue;
            subscriber.handler(JSON.parse(data), timestamp, version, type);
          }
        }
      }
      await invalidate?.(
        updates.map(({ event, updates }) => ({
          event,
          keys: updates.flatMap((update) => update.invalidate ?? [])
        }))
      );
    },
    getClientId: async (tx: TSqlRunner = db): Promise<string> => {
      return await tx
        .query<{ value: string }>(sql`SELECT value FROM metadata WHERE key = 'clientId'`)
        .then((rows) => rows[0]!.value);
    },
    getClock: async (tx: TSqlRunner = db): Promise<HLC> => {
      return HLC.fromString(
        await tx
          .query<{ value: string }>(sql`SELECT value FROM metadata WHERE key = 'clock'`)
          .then((rows) => {
            return rows[0]!.value;
          })
      );
    },
    async getMerkleTree(tx: TSqlRunner = db): Promise<MerkleTree<string, string>> {
      const jsonTree = await logger.getMetadata('merkle-tree', tx);
      if (!jsonTree) return new MerkleTree(16, stringHasher);

      try {
        return MerkleTree.fromString(jsonTree, stringHasher);
      } catch {
        return this.recomputeMerkleTree(tx);
      }
    },
    getMetadata: async (key: string, tx: TSqlRunner = db) => {
      return await tx
        .query<{ value: string }>(sql`SELECT value FROM metadata WHERE key = ${key}`)
        .then((rows) => rows[0]?.value ?? null);
    },
    getVersion: async (tx: TSqlRunner = db) => {
      return await tx
        .query<{ value: string }>(sql`SELECT value FROM metadata WHERE key = 'version'`)
        .then((rows) => rows[0]?.value);
    },
    on(
      type: '*' | TEvent['type'],
      handler: (
        data: TEvent['data'] | unknown,
        timestamp: string,
        version: string,
        type: string
      ) => void,
      opts: { remote?: boolean; self?: boolean } = {}
    ) {
      const subscribers = subscriptions.get(type) ?? new Set();
      const subscriber = {
        handler,
        remote: 'remote' in opts ? opts.remote! : true,
        self: 'self' in opts ? opts.self! : false
      };
      subscribers.add(subscriber);
      subscriptions.set(type, subscribers);
      return () => {
        const subscribers = subscriptions.get(type)!;
        subscribers.delete(subscriber);
      };
    },
    async persistMerkleTree(tree: MerkleTree<string, string>, tx: TSqlRunner) {
      await logger.setMetadata('merkle-tree', tree.toString(), tx);
    },
    receive: async (
      events: Array<TEvent & { timestamp: string; version: string }>,
      tx: TSqlRunner = db
    ): Promise<() => Promise<void>> => {
      if (!tx) return await db.transaction((tx) => logger.receive(events, tx));
      const version = await logger.getVersion(tx);
      if (version === undefined) throw new Error('Version not set');
      [events] = partitionArray(events, (event) => event.version <= version);
      if (events.length === 0) return async () => {};
      if (validateEvent) {
        for (let i = 0; i < events.length; i++) {
          const event = events[i]!;
          try {
            const validatedEvent = validateEvent(event);
            events[i] = Object.assign(validatedEvent, {
              timestamp: event.timestamp,
              version: event.version
            });
          } catch (error) {
            throw new Error(`Invalid event: ${JSON.stringify(event)}`, { cause: error });
          }
        }
      }
      const clock = await logger.getClock(tx);
      let updates: Array<{
        event: TEvent & { timestamp: string; version: string };
        updates: TUpdate[];
      }> = [];
      const loggedEvents = await tx.query<{
        data: string;
        timestamp: string;
        type: string;
        version: string;
      }>({
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
        await logger.applyUpdates(_updates, event.timestamp, tx);
        clock.receive(event.timestamp);
      }
      await logger.recomputeMerkleTree(tx);
      await logger.setClock(clock, tx);
      const tasks = [] as Promise<unknown>[];
      for (const { data, timestamp, type, version } of loggedEvents) {
        const blanketSubscribers = subscriptions.get('*');
        const eventSubscribers = subscriptions.get(type);
        let subscribers = new Set<{
          handler: (data: unknown, timestamp: string, version: string, type: string) => unknown;
          remote: boolean;
          self: boolean;
        }>();
        if (blanketSubscribers) subscribers = subscribers.union(blanketSubscribers);
        if (eventSubscribers) subscribers = subscribers.union(eventSubscribers);
        if (!subscribers) continue;
        for (const subscriber of subscribers) {
          if (subscriber.remote)
            tasks.push(
              Promise.resolve(subscriber.handler(JSON.parse(data), timestamp, version, type))
            );
        }
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
    async recomputeMerkleTree(tx: TSqlRunner = db) {
      const tree = new MerkleTree<string, string>(16, stringHasher);
      let hasNext = true;
      let after: null | string = null;
      while (hasNext) {
        const events: Array<{ timestamp: string }> = await tx.query<{ timestamp: string }>({
          params: after ? [after] : [],
          sql: `SELECT timestamp FROM events ${after ? 'WHERE timestamp > ?' : ''} ORDER BY timestamp ASC LIMIT 1000`
        });
        hasNext = events.length === 1000;
        if (events.length > 0)
          tree.insert(events.map((event) => ({ meta: event.timestamp, value: event.timestamp })));
        after = events[events.length - 1]?.timestamp ?? null;
      }
      await logger.persistMerkleTree(tree, tx);
      return tree;
    },
    async resetMerkleTree(tx: TSqlRunner = db) {
      logger.clearMetadata('merkle-tree', tx);
    },
    setClock: async (clock: HLC, tx: TSqlRunner) => {
      await tx.query(sql`UPDATE metadata SET value = ${clock.toString()} WHERE key = 'clock'`);
    },
    setMetadata: async (key: string, value: string, tx: TSqlRunner = db) => {
      if (['clientId', 'clock', 'version'].includes(key))
        throw new Error(`not allowed to manually set metadata key: ${key}`);
      await tx.query(
        sql`INSERT INTO metadata (key, value) VALUES (${key}, ${value}) ON CONFLICT(key) DO UPDATE SET value = ${value}`
      );
    },
    setVersion: async (version: string, tx: TSqlRunner = db) => {
      await tx.query(
        sql`INSERT INTO metadata (key, value) VALUES ('version', ${version}) ON CONFLICT(key) DO UPDATE SET value = ${version}`
      );
    }
  };

  return {
    clearMetadata: logger.clearMetadata,
    db,
    // TODO: figure out typescript here
    dispatch: logger.dispatch as never,
    getClientId: logger.getClientId,
    getClock: logger.getClock,
    getMerkleTree: logger.getMerkleTree,
    getMetadata: logger.getMetadata,
    getVersion: logger.getVersion,
    // @ts-expect-error: will fix later
    on: logger.on,
    receive: logger.receive,
    setMetadata: logger.setMetadata,
    setVersion: logger.setVersion,
    sql
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
  tx: TSqlRunner,
  schema: Map<string, Set<string>>
): Promise<boolean> {
  if (!schema.has(tableName)) return false;
  const result = await tx.query<{ value: number }>({
    params: [id],
    sql: `SELECT COUNT(1) as value FROM "${tableName}" WHERE "id" = ?`
  });
  return result[0]!.value > 0;
}

async function convertUpdateToStatement(
  update: TUpdate,
  timestamp: string,
  schema: Map<string, Set<string>>,
  tx: TSqlRunner
): Promise<null | { params: unknown[]; sql: string }[]> {
  const tableName = update.table;
  if (!schema.has(update.table)) throw new Error(`Table ${update.table} not found in schema`);
  const columns =
    update.operation !== 'delete'
      ? Object.keys(update.operation === 'sql' ? update.statements : update.data).filter(
          (column) =>
            !['createdAt', 'id', 'updatedAt'].includes(column) &&
            (update.operation === 'sql' ? update.statements : update.data)[column] !== undefined
        )
      : [];

  const id = update.id;

  switch (update.operation) {
    case 'delete': {
      return [{ params: [id], sql: `DELETE FROM "${tableName}" WHERE "id" = ?` }];
    }
    case 'insert': {
      const values = columns.map((column) => update.data[column]);
      return [
        {
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
        }
      ];
    }
    case 'sql': {
      const existingUpdatedAt = await tx
        .query<{ updatedAt: string }>({
          params: [id],
          sql: `SELECT updatedAt FROM "${tableName}" WHERE "id" = ?`
        })
        .then((rows) => JSON.parse(rows[0]?.updatedAt ?? '{}') as Record<string, string>);
      const columnsToUpdate = columns.filter((column) => {
        const existingTimestamp = existingUpdatedAt[column];
        return typeof existingTimestamp !== 'string' || existingTimestamp < timestamp;
      });

      const statementsToRun = [] as { params: unknown[]; sql: string }[];
      for (const column in update.statements) {
        for (const statement of update.statements[column]!) {
          const shouldRun =
            statement.executeEvenIfTimestampIsOlder || columnsToUpdate.includes(column);
          if (!shouldRun) continue;
          statementsToRun.push({
            params: statement.params.map(toSql),
            sql: statement.sql
          });
        }
      }
      return [
        ...statementsToRun,
        {
          params: [
            Object.fromEntries(columnsToUpdate.map((column) => [column, timestamp])),
            id
          ].map(toSql),
          sql: `UPDATE "${tableName}" SET updatedAt = json_patch(updatedAt, ?) WHERE "id" = ?`
        }
      ];
    }
    case 'update': {
      const existingUpdatedAt = await tx
        .query<{ updatedAt: string }>({
          params: [id],
          sql: `SELECT updatedAt FROM "${tableName}" WHERE "id" = ?`
        })
        .then((rows) => JSON.parse(rows[0]?.updatedAt ?? '{}') as Record<string, string>);
      const columnsToUpdate = columns.filter((column) => {
        const existingTimestamp = existingUpdatedAt[column];
        return typeof existingTimestamp !== 'string' || existingTimestamp < timestamp;
      });
      if (columnsToUpdate.length === 0) return null;
      return [
        {
          params: [
            ...columnsToUpdate.map((column) => update.data[column]),
            Object.fromEntries(columnsToUpdate.map((column) => [column, timestamp])),
            id
          ].map(toSql),
          sql: `
          UPDATE "${tableName}"
          SET
            ${columnsToUpdate.map((column) => `"${column}" = ?`).join(',')},
            updatedAt = json_patch(updatedAt, ?)
          WHERE "id" = ?
        `
        }
      ];
    }
    case 'upsert': {
      const existingUpdatedAt = await tx
        .query<{ updatedAt: string }>({
          params: [id],
          sql: `SELECT updatedAt FROM "${tableName}" WHERE "id" = ?`
        })
        .then((rows) => JSON.parse(rows[0]?.updatedAt ?? '{}') as Record<string, string>);
      const columnsToUpsert = columns.filter((column) => {
        const existingTimestamp = existingUpdatedAt[column];
        return typeof existingTimestamp !== 'string' || existingTimestamp < timestamp;
      });
      if (columnsToUpsert.length === 0) return null;

      const insertSql = `
              INSERT INTO "${tableName}"(
                "id",
                ${columnsToUpsert.map((column) => `"${column}"`).join(',')},
                "createdAt",
                "updatedAt"
              )
              VALUES (
                ?,
                ${columnsToUpsert.map(() => '?').join(',')},
                ?, 
                ?
              )
            `;

      const updateSql = `
              SET 
                ${columnsToUpsert.map((column) => `"${column}" = ?`).join(',')},
                updatedAt = json_patch(updatedAt, ?)
              WHERE "id" = ?
            `;

      const upsertSql = `
              ${insertSql}
              ON CONFLICT("id") DO UPDATE
              ${updateSql}
            `;

      const insertParams = [
        id,
        ...columnsToUpsert.map((column) => update.data[column]),
        timestamp,
        {}
      ].map(toSql);
      const updateParams = [
        ...columnsToUpsert.map((c) => update.data[c]),
        Object.fromEntries(columnsToUpsert.map((column) => [column, timestamp])),
        id
      ].map(toSql);

      const params = [...insertParams, ...updateParams];

      return [{ params, sql: upsertSql }];
    }
  }
}

async function migratePendingEventsStatements(db: TSqlDB): Promise<void> {
  const MIGRATION_KEY = '__event_logger_migration_v1_pendingEvents_statements';
  const existing = await db.query<{ value: string }>({
    params: [MIGRATION_KEY],
    sql: 'SELECT value FROM metadata WHERE key = ?'
  });
  if (existing.length > 0) return;
  await db.batch([
    sql`ALTER TABLE pendingEvents ADD COLUMN statements text NOT NULL DEFAULT '{}'`,
    sql`INSERT INTO metadata (key, value) VALUES (${MIGRATION_KEY}, 'done') ON CONFLICT(key) DO UPDATE SET value = 'done'`
  ]);
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
  tx: TSqlRunner,
  schema: Map<string, Set<string>>
): Promise<void> {
  const pendingEvents = await tx
    .query<{
      data: string;
      id: string;
      operation: 'delete' | 'insert' | 'sql' | 'update' | 'upsert';
      statements: string;
      table: string;
      timestamp: string;
    }>({
      params: [id, tableName],
      sql: `SELECT id, "table", timestamp, data, operation, statements FROM pendingEvents WHERE id = ? AND "table" = ? ORDER BY timestamp ASC`
    })
    .then((rows) =>
      rows.map((row) =>
        Object.assign(row, { data: JSON.parse(row.data), statements: JSON.parse(row.statements) })
      )
    );

  for (const event of pendingEvents) {
    const statements = await convertUpdateToStatement(
      event as TUpdate,
      event.timestamp,
      schema,
      tx
    );
    if (statements === null) continue;
    if (statements.length === 0) continue;
    await tx.batch(statements);
  }

  if (pendingEvents.length > 0) {
    await tx.query({
      params: [id, tableName],
      sql: `DELETE FROM pendingEvents WHERE id = ? AND "table" = ?`
    });
  }
}

function sql(strings: TemplateStringsArray, ...values: unknown[]): TStatement {
  return {
    params: values.map(toSql),
    sql: strings.reduce((sql, part, i) => sql + part + (i < values.length ? '?' : ''), '')
  };
}

async function storePendingEvent(
  update: TUpdate,
  timestamp: string,
  tx: TSqlRunner
): Promise<void> {
  const data = 'data' in update ? update.data : {};
  const statements = update.operation === 'sql' ? JSON.stringify(update.statements) : '{}';
  await tx.query({
    params: [
      update.id,
      update.table,
      timestamp,
      JSON.stringify(data),
      update.operation,
      statements
    ],
    sql: `INSERT OR IGNORE INTO pendingEvents (id, "table", timestamp, data, operation, statements) VALUES (?, ?, ?, ?, ?, ?)`
  });
}
