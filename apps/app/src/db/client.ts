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

export { db };
