import type { SQLocal } from 'sqlocal';

import type { TSqlDB, TSqlRunner, TStatement } from '..';

export function fromSQLocal(db: SQLocal): TSqlDB {
  const runner = runnerFromSQLocal(db);
  return {
    ...runner,
    transaction(callback) {
      return db.transaction((tx) => callback(runnerFromSQLocal(tx)));
    }
  };
}

export function runnerFromSQLocal(db: Pick<SQLocal, 'batch'>): TSqlRunner {
  return {
    async batch(statement) {
      await db.batch(() => statement);
    },
    query<T extends Record<string, unknown>>(statement: TStatement) {
      return db.batch<T>(() => [statement]).then((result) => result[0]!);
    }
  };
}
