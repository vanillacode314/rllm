import { z } from 'zod/mini';

const envSchema = z.object({
	DATABASE_AUTH_TOKEN: z.string().check(z.minLength(1)),
	DATABASE_CONNECTION_URL: z.string()
});

export const env = envSchema.parse(process.env);
