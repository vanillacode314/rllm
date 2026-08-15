// oxlint-disable no-await-in-loop
import { AsyncResult } from 'ts-result-option';

import type { SqliteAdapter } from './client.types';

import { migrationHooks } from './migrationHooks';
import migrations from './migrations.json' with { type: 'json' };

export const setupDb = (logger: SqliteAdapter['logger']) =>
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

      const [clock, version] = await Promise.all([logger.getClock(), logger.getVersion()]);
      console.debug('[DB Metadata]', { clock: clock.toString(), version });
    },
    (e) => new Error('Failed to setup database', { cause: e })
  );
