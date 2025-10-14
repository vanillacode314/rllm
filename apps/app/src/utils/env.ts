import { type } from 'arktype';

const envSchema = type({
	'+': 'delete',
	DATABASE_AUTH_TOKEN: 'string > 0',
	DATABASE_CONNECTION_URL: 'string.url'
});

const env = envSchema(process.env) as typeof envSchema.infer;
if (env instanceof type.errors) {
	throw new Error(`Invalid Env: ${env.summary}`);
}

export { env };
