import type { SqliteAdapter } from './client.types';

declare const { db, getDb, getLogger, logger }: SqliteAdapter;
export { db, getDb, getLogger, logger };
