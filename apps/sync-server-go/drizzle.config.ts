import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dbCredentials: {
    authToken: process.env.DATABASE_AUTH_TOKEN || "TERM", // random fallback for local db,
    url: process.env.DATABASE_CONNECTION_URL!,
  },
  dialect: "turso",
  out: "./db/migrations",
  migrations: { prefix: "supabase" },
  schema: "./schema.ts",
  strict: true,
  verbose: true,
});
