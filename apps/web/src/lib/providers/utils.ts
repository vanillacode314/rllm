import { Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import type { TModel } from '~/types';

import { OpenAIAdapter } from '~/lib/adapters/openai';
import { ProxyManager } from '~/lib/proxy';
import { formatError } from '~/utils/errors';

export type TestProviderResult =
  | {
      error: string;
      success: false;
    }
  | {
      models: TModel[];
      success: true;
    };

interface TestProviderOptions {
  baseUrl: string;
  token: string;
}

/**
 * Test provider by fetching available models from its API.
 */
export function testProvider(options: TestProviderOptions): Promise<TestProviderResult> {
  return tryBlock(
    async function* () {
      const { baseUrl, token } = options;
      const adapter = new OpenAIAdapter(baseUrl, token);
      const models = yield* adapter.fetchAllModels();

      return Result.Ok(models);
    },
    (e) => new Error('Failed to test provider', { cause: e })
  ).match<TestProviderResult>(
    (models) => ({ success: true, models }),
    (error) => ({ success: false, error: formatError(error) })
  );
}
