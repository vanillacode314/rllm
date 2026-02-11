import { type } from 'arktype';

const envSchema = type({
	'+': 'delete',
	'VITE_SYNC_SERVER_BASE_URL?': 'string.url'
});

const env = envSchema(import.meta.env) as typeof envSchema.infer;
if (env instanceof type.errors) {
	throw new Error(`Invalid Env: ${env.summary}`);
}

export { env };
