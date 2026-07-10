import type { SqliteAdapter } from './client.types';

declare const { db, deleteDatabaseFile, getDatabaseSize, logger }: SqliteAdapter;
export { db, deleteDatabaseFile, getDatabaseSize, logger };
