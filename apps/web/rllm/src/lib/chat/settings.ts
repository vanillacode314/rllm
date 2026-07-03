import type { ParsedLocation } from '@tanstack/solid-router';

import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import { chatsSchema } from '~/db/app-schema';
import { logger } from '~/db/client';
import { fetchers } from '~/queries';
import { chatSettings, setChatSettings } from '~/routes/(chat)/-state';

export const chatSettingsSchema = z.object({
  includeDateTimeInSystemPrompt: z._default(z.boolean(), true),
  modelId: z.string(),
  providerId: z.string(),
  reasoning: z._default(z.enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']), 'medium'),
  systemPrompt: z._default(z.string(), '')
  // 'temperature?': 'number'
  // "topP?": "number",
  // "frequencyPenalty?": "number",
  // "presencePenalty?": "number",
  // "maxTokens?": "number",
  // "stop?": "string[]",
});
export type TChatSettings = z.infer<typeof chatSettingsSchema>;

export async function initChatSettings() {
  const [titleGenerationProviderId, titleGenerationModelId, providers] = await Promise.all([
    fetchers.userMetadata.byId('title-generation-provider-id'),
    fetchers.userMetadata.byId('title-generation-model-id'),
    fetchers.providers.getAllProviders()
  ]);
  if (providers.length === 0) {
    console.debug(`[Initializing Chat Settings] No providers found, skipping initialization`);
    return;
  }
  const tasks = [] as (() => Promise<unknown>)[];
  if (titleGenerationProviderId === null) {
    console.debug(
      `[Initializing Chat Settings] titleGenerationProviderId is null, setting to ${providers[0].id}`
    );
    tasks.push(() =>
      logger.dispatch({
        data: {
          id: 'title-generation-provider-id',
          value: providers[0].id
        },
        type: 'setUserMetadata'
      })
    );
  } else if (!providers.some((provider) => provider.id !== titleGenerationProviderId)) {
    console.debug(
      `[Initializing Chat Settings] titleGenerationProviderId ${titleGenerationProviderId} not found, setting to ${providers[0].id}`
    );
    tasks.push(() =>
      logger.dispatch(
        {
          data: {
            id: 'title-generation-provider-id',
            value: providers[0].id
          },
          type: 'setUserMetadata'
        },
        {
          data: {
            id: 'title-generation-model-id',
            value: providers[0].defaultModelIds[0]
          },
          type: 'setUserMetadata'
        }
      )
    );
  } else if (titleGenerationModelId === null) {
    console.debug(
      `[Initializing Chat Settings] titleGenerationModelId is null, setting to ${providers[0].defaultModelIds[0]}`
    );
    const provider = await fetchers.providers.byId(titleGenerationProviderId);
    if (!provider) throw new Error('Provider not found');
    tasks.push(() =>
      logger.dispatch({
        data: {
          id: 'title-generation-model-id',
          value: provider.defaultModelIds[0]
        },
        type: 'setUserMetadata'
      })
    );
  }
  await Promise.all(tasks.map((task) => task()));
  setChatSettings(
    Option.Some({
      includeDateTimeInSystemPrompt: true,
      modelId: providers[0].defaultModelIds[0],
      providerId: providers[0].id,
      reasoning: 'medium',
      systemPrompt: ''
    })
  );
}

export async function updateChatSettings(
  settings: Partial<TChatSettings>,
  location: ParsedLocation<{ id?: string }>
) {
  const scratchpad = location.pathname.startsWith('/scratchpad');
  const chatId = location.pathname.startsWith('/chat') ? location.search.id : undefined;
  if (chatSettings().isNone()) return;
  const newValue = { ...chatSettings().unwrap(), ...settings };
  setChatSettings(Option.Some(newValue));
  if (scratchpad) {
    const chat = Option.from(await fetchers.userMetadata.byId('scratchpad-chat'))
      .okOrElse(() => new Error('No chat found'))
      .andThen((value) => safeParseJson(value, { validate: chatsSchema.parse }))
      .expect('Failed to parse chat');
    await logger.dispatch({
      data: {
        id: 'scratchpad-chat',
        value: JSON.stringify({
          ...chat,
          settings: newValue
        })
      },
      dontLog: true,
      type: 'setUserMetadata'
    });
    return;
  }
  if (chatId) {
    await logger.dispatch({
      data: { id: chatId, settings: newValue },
      type: 'updateChat'
    });
  }
}
