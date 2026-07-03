import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';

import { chatsSchema, type TChat, type TProvider } from '~/db/app-schema';
import { fetchers } from '~/queries';

export interface ChatGenerationStorage {
  getChat(id: string): Promise<{ chat: Option<TChat>; provider: Option<TProvider> }>;
}

export const dbStorage: ChatGenerationStorage = {
  async getChat(id) {
    const chat = Option.from(await fetchers.chats.byId(id));
    const provider = chat.isNone()
      ? Option.None()
      : Option.from(await fetchers.providers.byId(chat.unwrap().settings.providerId));
    return { chat, provider };
  }
};

export const scratchpadStorage: ChatGenerationStorage = {
  async getChat(id) {
    const chat = Option.from(await fetchers.userMetadata.byId('scratchpad-chat'))
      .okOrElse(() => new Error('No chat found'))
      .andThen((value) => safeParseJson(value, { validate: chatsSchema.parse }))
      .ok()
      .filter((chat) => chat.id === id);
    const provider = chat.isNone()
      ? Option.None()
      : Option.from(await fetchers.providers.byId(chat.unwrap().settings.providerId));
    return { chat, provider };
  }
};
