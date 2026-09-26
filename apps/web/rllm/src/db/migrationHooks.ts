import type { TSqlRunner } from 'event-logger';

export const migrationHooks: Record<
  string,
  Array<{
    after?: (tx: TSqlRunner) => Promise<void>;
    before?: (tx: TSqlRunner) => Promise<void>;
  }>
> = Object.freeze({});
