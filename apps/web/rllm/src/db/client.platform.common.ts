// oxlint-disable no-await-in-loop
import { sql } from 'event-logger';
import { AsyncResult } from 'ts-result-option';

import type { LoggerInstance } from './client.types';
import { migrationHooks } from './migrationHooks';
import migrations from './migrations.json' with { type: 'json' };

export function createLoggerProxy(getLogger: () => Promise<LoggerInstance>): LoggerInstance {
  return {
    clearMetadata: async (key, tx) => (await getLogger()).clearMetadata(key, tx),
    get db() {
      return {
        batch: (statements: Parameters<LoggerInstance['db']['batch']>[0]) =>
          getLogger().then((instance) => instance.db.batch(statements)),
        query: (statement: Parameters<LoggerInstance['db']['query']>[0]) =>
          getLogger().then((instance) => instance.db.query(statement)),
        transaction: <T>(
          fn: (tx: Parameters<Parameters<LoggerInstance['db']['transaction']>[0]>[0]) => Promise<T>
        ) => getLogger().then((instance) => instance.db.transaction(fn))
      } as LoggerInstance['db'];
    },
    dispatch: async (...events) => (await getLogger()).dispatch(...events),
    getClientId: async () => (await getLogger()).getClientId(),
    getClock: async () => (await getLogger()).getClock(),
    getMerkleTree: async () => (await getLogger()).getMerkleTree(),
    getMetadata: async (key) => (await getLogger()).getMetadata(key),
    getVersion: async () => (await getLogger()).getVersion(),
    invalidateSchema: async () => (await getLogger()).invalidateSchema(),
    on: (type, handler, opts) => {
      let unsubscribe: (() => void) | null = null;
      let isCancelled = false;

      void getLogger().then((instance) => {
        if (!isCancelled) {
          unsubscribe = instance.on(type, handler, opts);
        }
      });

      return () => {
        isCancelled = true;
        if (unsubscribe) unsubscribe();
      };
    },
    receive: async (events, tx) => (await getLogger()).receive(events, tx),

    setMetadata: async (key, value) => (await getLogger()).setMetadata(key, value),

    setVersion: async (version, tx) => (await getLogger()).setVersion(version, tx),

    get sql() {
      return sql;
    }
  };
}

export const setupDb = (logger: LoggerInstance) =>
  AsyncResult.from<void, Error>(
    async function () {
      const currentVersion = await logger.getVersion();

      for (const version of Object.keys(migrations).toSorted()) {
        if (currentVersion !== undefined && version <= currentVersion) continue;
        console.debug(`Running migration ${version}`);
        const statements = migrations[version as keyof typeof migrations];
        const hooks = migrationHooks[version] ?? [];
        if (hooks.length > 0) {
          console.log(`Found ${hooks.length} hooks for version ${version}`);
        }
        await logger.db.transaction(async (tx) => {
          for (const hook of hooks) {
            if (hook.before) await hook.before(tx);
          }
          await tx.batch(
            statements.map((statement) => ({
              params: [],
              sql: statement
            }))
          );
          for (const hook of hooks) {
            if (hook.after) await hook.after(tx);
          }
          await logger.setVersion(version, tx);
        });
        console.debug(`Migration ${version} applied`);
      }
      await logger.invalidateSchema();

      void Promise.all([logger.getClock(), logger.getVersion()]).then(([clock, version]) => {
        console.debug('[DB Metadata]', { clock: clock.toString(), version });
      });
    },
    (e) => new Error('Failed to setup database', { cause: e })
  );
