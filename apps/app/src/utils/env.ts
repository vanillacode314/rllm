import { z } from 'zod/mini';

const envSchema = z.object({
  DATABASE_AUTH_TOKEN:
    process.env.NODE_ENV === 'production' ?
      z.string().check(z.minLength(1))
    : z.optional(z.string()),
  DATABASE_CONNECTION_URL: z.string()
});

export const env = envSchema.parse(process.env);
