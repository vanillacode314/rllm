import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { Logger } from 'event-logger';

import type { TValidEvent } from '~/queries/mutations';

import type { tables } from './schema';

export type DrizzleDB = SqliteRemoteDatabase<typeof tables>;
export type LoggerInstance = Logger<TValidEvent & { timestamp: string; version: string }>;

export interface SqliteAdapter {
  getDb: () => Promise<DrizzleDB>;
  getLogger: () => Promise<LoggerInstance>;
  logger: LoggerInstance;
}
