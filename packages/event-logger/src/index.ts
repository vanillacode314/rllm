import { HLC } from 'hlc';
import { MerkleTree, stringHasher } from 'merkle-tree';
import { type ClientConfig, SQLocal, type Transaction } from 'sqlocal';

export type TConfig<TEvent extends Omit<TBaseEvent, 'timestamp' | 'version'>> = {
  config: ClientConfig;
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
  tx: TTransaction
) => MaybePromise<TUpdate[]>;

export type TUpdate =
  | {
      creates: boolean;
      id: string;
      invalidate?: Array<string[]>;
      modifiesColumns: string[];
      operation: 'sql';
      params: unknown[];
      sql: string;
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
  clearMetadata: (key: string, tx?: TTransaction) => Promise<void>;
  db: SQLocal;
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
  receive: (events: Array<T>, tx?: TTransaction) => Promise<() => Promise<void>>;
  setMetadata: (key: string, value: string) => Promise<void>;
  setVersion: (version: string, tx?: TTransaction) => Promise<void>;
}
type MaybePromise<T> = Promise<T> | T;
type TBaseEvent = { data: unknown; timestamp: string; type: string; version: string };

type TTransaction = Pick<Transaction, 'batch' | 'query'>;

export async function createEventLogger<TEvent extends Omit<TBaseEvent, 'timestamp' | 'version'>>({
  config,
  eventToUpdates,
  invalidate,
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
      sql`CREATE TABLE IF NOT EXISTS \`pendingEvents\` (\`id\` text NOT NULL, \`table\` text NOT NULL, \`timestamp\` text NOT NULL, \`data\` text NOT NULL, \`operation\` text NOT NULL, PRIMARY KEY (\`id\`, \`table\`, \`timestamp\`));`,
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
      handler: (data: unknown, timestamp: string, version: string, type: string) => unknown;
      remote: boolean;
      self: boolean;
    }>
  >();

  const logger = {
    applyUpdates: async (updates: TUpdate[], timestamp: string, tx: TTransaction) => {
      if (updates.length === 0) return;
      const schema = await getSchema(tx);
      for (const update of updates) {
        const statements = await convertUpdateToStatement(update, timestamp, schema, tx);
        if (statements === null) continue;
        try {
          if (update.operation === 'insert' || (update.operation === 'sql' && update.creates)) {
            await tx.batch(() => statements);
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
              await tx.batch(() => statements);
            }
          } else {
            await tx.batch(() => statements);
          }
        } catch (error) {
          console.debug(`Failed to apply update`, statements, update);
          throw new Error(`Failed to apply update`, { cause: error });
        }
      }
    },
    clearMetadata: async (key: string, tx?: TTransaction) => {
      const q = tx ? tx.query : query;
      await q({
        params: [key],
        sql: `DELETE FROM metadata WHERE key = ?`
      });
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
        const tree = await logger.getMerkleTree(tx);
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
        for (const event of loggedEvents ?? []) {
          tree.insert(event.timestamp, event.timestamp);
        }
        await logger.persistMerkleTree(tree, tx);
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
    async getMerkleTree(tx?: TTransaction): Promise<MerkleTree<string, string>> {
      const jsonTree = await logger.getMetadata('merkle-tree', tx);
      if (!jsonTree) return new MerkleTree(16, stringHasher);

      try {
        return MerkleTree.fromString(jsonTree, stringHasher);
      } catch {
        return this.recomputeMerkleTree(tx);
      }
    },
    getMetadata: async (key: string, tx?: TTransaction) => {
      const _query = tx ? tx.query : query;
      return await _query<{ value: string }>({
        params: [key],
        sql: 'SELECT value FROM metadata WHERE key = ?'
      }).then((rows) => rows[0]?.value ?? null);
    },
    getVersion: async (tx?: TTransaction) => {
      const _query = tx ? tx.query : query;
      return await _query<{ value: string }>({
        params: [],
        sql: "SELECT value FROM metadata WHERE key = 'version'"
      }).then((rows) => rows[0]?.value);
    },
    async insertTimestampIntoMerkleTree(id: string, tx?: TTransaction) {
      const tree = await logger.getMerkleTree(tx);
      tree.insert(id, id);
      await logger.persistMerkleTree(tree, tx);
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
    async persistMerkleTree(tree: MerkleTree<string, string>, tx?: TTransaction) {
      await logger.setMetadata('merkle-tree', tree.toString(), tx);
    },
    receive: async (
      events: Array<TEvent & { timestamp: string; version: string }>,
      tx?: TTransaction
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
    async recomputeMerkleTree(tx?: TTransaction) {
      const tree = new MerkleTree<string, string>(16, stringHasher);
      let hasNext = true;
      let after: null | string = null;
      const q = tx ? tx.query : query;
      while (hasNext) {
        const events: Array<{ timestamp: string }> = await q<{ timestamp: string }>({
          params: after ? [after] : [],
          sql: `SELECT timestamp FROM events ${after ? 'WHERE timestamp > ?' : ''} ORDER BY timestamp ASC LIMIT 1000`
        });
        hasNext = events.length === 1000;
        for (const event of events) {
          tree.insert(event.timestamp, event.timestamp);
        }
        after = events[events.length - 1]?.timestamp ?? null;
      }
      await logger.persistMerkleTree(tree, tx);
      return tree;
    },
    async resetMerkleTree(tx?: TTransaction) {
      logger.clearMetadata('merkle-tree', tx);
    },
    setClock: async (clock: HLC, tx: TTransaction) => {
      await tx.query({
        params: [clock.toString()],
        sql: `UPDATE metadata SET value = ? WHERE key = 'clock'`
      });
    },
    setMetadata: async (key: string, value: string, tx?: TTransaction) => {
      if (['clientId', 'clock', 'version'].includes(key))
        throw new Error(`not allowed to manually set metadata key: ${key}`);
      const q = tx ? tx.query : query;
      await q({
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
  tx: TTransaction
): Promise<null | { params: unknown[]; sql: string }[]> {
  const tableName = update.table;
  if (!schema.has(update.table)) throw new Error(`Table ${update.table} not found in schema`);
  const columns =
    update.operation !== 'delete' ?
      update.operation === 'sql' ?
        update.modifiesColumns
      : Object.keys(update.data).filter(
          (column) =>
            !['createdAt', 'id', 'updatedAt'].includes(column) && update.data[column] !== undefined
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
        .query({
          params: [id],
          sql: `SELECT updatedAt FROM "${tableName}" WHERE "id" = ?`
        })
        .then((rows) => JSON.parse(rows[0]?.updatedAt ?? '{}') as Record<string, string>);
      const columnsToUpdate = columns.filter((column) => {
        const existingTimestamp = existingUpdatedAt[column];
        return typeof existingTimestamp !== 'string' || existingTimestamp < timestamp;
      });
      return [
        { params: update.params.map(toSql), sql: update.sql },
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
        .query({
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
        .query({
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

  for (const event of pendingEvents) {
    const statements = await convertUpdateToStatement(event, event.timestamp, schema, tx);
    if (statements === null) continue;
    await tx.batch(() => statements);
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
    sql: `INSERT OR IGNORE INTO pendingEvents (id, "table", timestamp, data, operation) VALUES (?, ?, ?, ?, ?)`
  });
}
