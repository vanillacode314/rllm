import { makePersisted } from '@solid-primitives/storage';
import { createSignal } from 'solid-js';
import { safeParseJson } from 'ts-result-option/utils';
import * as z from 'zod/mini';

const accountSchema = z.object({
  id: z.string(),
  aesKey: z.pipe(z.looseObject({}), z.custom<JsonWebKey, Record<PropertyKey, unknown>>()),
  privateKey: z.string(),
  publicKey: z.string()
});
type TAccount = z.infer<typeof accountSchema>;

const [account, setAccount] = makePersisted(createSignal<null | TAccount>(null), {
  name: 'rllm:account',
  serialize: (data): string => {
    const result = accountSchema.safeParse(data);
    if (result.error) return JSON.stringify(null);
    return JSON.stringify(data);
  },
  deserialize: (data): null | TAccount => {
    const result = safeParseJson(data, { validate: accountSchema.parse });
    if (result.isErr()) return null;
    return result.unwrap();
  }
});

export { account, setAccount };
