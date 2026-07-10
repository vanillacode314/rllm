import type { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { createEventLogger } from 'event-logger';

import type { TValidEvent } from '~/queries/mutations';

import type { tables } from './schema';

export interface SqliteAdapter {
  DATABASE_PATH: string;
  db: ReturnType<typeof drizzle<typeof tables>>;
  deleteDatabaseFile: () => Promise<void>;
  getDatabaseSize: () => Promise<number>;
  logger: Awaited<ReturnType<typeof createEventLogger<TValidEvent>>>;
}
