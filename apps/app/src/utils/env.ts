import { Type } from 'typebox';
import Value from 'typebox/value';

const EnvSchema = Type.Object({
	DATABASE_AUTH_TOKEN: Type.String({ minLength: 1 }),
	DATABASE_CONNECTION_URL: Type.String({ format: 'uri' })
});

export const env = Value.Parse(EnvSchema, process.env);
