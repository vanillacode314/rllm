import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dbCredentials: {
		url: process.env.DATABASE_CONNECTION_URL!
	},
	dialect: 'sqlite',
	migrations: {
		prefix: 'supabase'
	},
	schema: 'src/db/schema.ts',
	strict: true,
	verbose: true
});
