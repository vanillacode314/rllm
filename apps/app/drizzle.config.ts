import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dbCredentials: {
		authToken: process.env.DATABASE_AUTH_TOKEN,
		url: process.env.DATABASE_CONNECTION_URL!
	},
	dialect: 'turso',
	migrations: {
		prefix: 'supabase'
	},
	schema: 'src/db/schema.ts',
	strict: true,
	verbose: true
});
