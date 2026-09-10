import type { SqliteAdapter } from './client.types';

declare const { getDb, getLogger, logger }: SqliteAdapter;
export { getDb, getLogger, logger };
