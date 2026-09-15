import { Option } from 'ts-result-option';

import type { TChat, TProvider } from '~/db/app-schema';
import { db } from '~/db/client';

export interface ChatGenerationStorage {
  getChat(id: string): Promise<{ chat: Option<TChat>; provider: Option<TProvider> }>;
}

export const dbStorage: ChatGenerationStorage = {
  async getChat(id) {
    const chat = Option.from(await db.chats.get(id));
    const provider = chat.isNone()
      ? Option.None()
      : Option.from(await db.providers.get(chat.unwrap().settings.providerId));
    return { chat, provider };
  }
};

export const scratchpadStorage: ChatGenerationStorage = {
  async getChat(id) {
    const chat = Option.from(await db.userMetadata.scratchpadChat()).filter(
      (chat) => chat.id === id
    );
    const provider = chat.isNone()
      ? Option.None()
      : Option.from(await db.providers.get(chat.unwrap().settings.providerId));
    return { chat, provider };
  }
};
