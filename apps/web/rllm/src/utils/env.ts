import * as z from 'zod/mini';

const envSchema = z.object({
  VITE_SYNC_SERVER_BASE_URL: z.optional(z.url())
});

const result = envSchema.safeParse(import.meta.env);
if (!result.success) {
  throw new Error(`Invalid Env: ${z.prettifyError(result.error)}`);
}

export const env = result.data;
