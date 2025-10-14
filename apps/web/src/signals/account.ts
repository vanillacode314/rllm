import { makePersisted } from '@solid-primitives/storage';
import { type } from 'arktype';
import { createSignal } from 'solid-js';
import { safeParseJson } from 'ts-result-option/utils';

const accountSchema = type({
	id: 'string',
	aesKey: type('object').as<JsonWebKey>(),
	privateKey: 'string',
	publicKey: 'string'
});
type TAccount = typeof accountSchema.infer;

const [account, setAccount] = makePersisted(createSignal<null | TAccount>(null), {
	name: 'rllm:account',
	serialize: (data): string => {
		const invalid = accountSchema(data) instanceof type.errors;
		if (invalid) return JSON.stringify(null);
		return JSON.stringify(data);
	},
	deserialize: (data): null | TAccount => {
		const result = safeParseJson(data, { validate: accountSchema.assert });
		if (result.isErr()) return null;
		return result.unwrap();
	}
});

export { account, setAccount };
