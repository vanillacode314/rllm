import type { SqliteAdapter } from './client.types';

declare const { db, getDatabaseSize, logger }: SqliteAdapter;
export { db, getDatabaseSize, logger };
