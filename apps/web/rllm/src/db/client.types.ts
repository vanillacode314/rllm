import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { Logger } from 'event-logger';

import type { TValidEvent } from '~/queries/mutations';

import type { tables } from './schema';
import type { createDbApi } from './utils';

export type DrizzleDB = SqliteRemoteDatabase<typeof tables>;
export type LoggerInstance = Logger<TValidEvent & { timestamp: string; version: string }>;

export interface SqliteAdapter {
  db: ReturnType<typeof createDbApi>;
  getDb: () => Promise<DrizzleDB>;
  getLogger: () => Promise<LoggerInstance>;
  logger: LoggerInstance;
}
