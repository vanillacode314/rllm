import { db } from '~/db/client';
import { chatState, updateChatSettings } from '~/routes/(chat)/-state';
import type { TChatSettings } from '~/types/chat';

export async function initChatSettings() {
  const [titleGenerationProviderId, titleGenerationModelId, providers] = await Promise.all([
    db.userMetadata.titleGenerationProviderId(),
    db.userMetadata.titleGenerationModelId(),
    db.providers.all()
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
    tasks.push(() => db.userMetadata.setTitleGenerationProviderId(providers[0].id));
  } else if (!providers.some((provider) => provider.id !== titleGenerationProviderId)) {
    console.debug(
      `[Initializing Chat Settings] titleGenerationProviderId ${titleGenerationProviderId} not found, setting to ${providers[0].id}`
    );
    tasks.push(() => db.userMetadata.setTitleGeneration(providers[0].id));
  } else if (titleGenerationModelId === null) {
    console.debug(
      `[Initializing Chat Settings] titleGenerationModelId is null, setting to ${providers[0].defaultModelIds[0]}`
    );
    const provider = await db.providers.get(titleGenerationProviderId);
    if (!provider) throw new Error('Provider not found');
    tasks.push(() => db.userMetadata.setTitleGenerationModelId(provider.defaultModelIds[0]));
  }
  await Promise.all(tasks.map((task) => task()));
  if (chatState.settings.isNone()) {
    updateChatSettings({
      includeDateTimeInSystemPrompt: true,
      modelId: providers[0].defaultModelIds[0],
      providerId: providers[0].id,
      reasoning: 'medium',
      systemPrompt: ''
    });
  }
}

export async function saveChatSettings(
  settings: Partial<TChatSettings>,
  opts: Partial<{ chatId: string; scratchpad: boolean }>
) {
  const { chatId, scratchpad } = opts;
  if (chatState.settings.isNone()) return;
  const updatedSettings = { ...chatState.settings.unwrap(), ...settings };
  updateChatSettings(updatedSettings);

  if (scratchpad) {
    const chat = await db.userMetadata.scratchpadChat();
    if (!chat) return;
    await db.userMetadata.setScratchpadChat({ ...chat, settings: updatedSettings });
    return;
  }

  if (chatId) {
    await db.chats.update(chatId, { settings: updatedSettings });
  }
}
