import { AsyncResult } from 'ts-result-option';

import type { SqliteAdapter } from './client.types';

import migrations from './migrations.json' with { type: 'json' };

export const setupDb = (logger: SqliteAdapter['logger']) =>
  AsyncResult.from<void, Error>(
    async function () {
      const currentVersion = await logger.getVersion();

      for (const version of Object.keys(migrations).toSorted()) {
        if (currentVersion !== undefined && version <= currentVersion) continue;
        console.debug(`Running migration ${version}`);
        const statements = migrations[version as keyof typeof migrations];
        // oxlint-disable-next-line no-await-in-loop
        await logger.db.transaction(async (tx) => {
          await tx.batch(
            statements.map((statement) => ({
              params: [],
              sql: statement
            }))
          );
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
