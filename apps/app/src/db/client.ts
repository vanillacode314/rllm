import { drizzle } from 'drizzle-orm/libsql';

import { env } from '~/utils/env.js';

import * as schema from './schema';

const db = drizzle({
	connection: {
		authToken: env.DATABASE_AUTH_TOKEN,
		url: env.DATABASE_CONNECTION_URL
	},
	schema
});
type TTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export { db };
export type { TTransaction };
