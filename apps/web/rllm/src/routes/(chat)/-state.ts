import { makePersisted } from '@solid-primitives/storage';
import { produce } from 'immer';
import localforage from 'localforage';
import { createStore } from 'solid-js/store';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import * as z from 'zod/mini';

import { chatSettingsSchema, type TChatSettings } from '~/lib/chat/settings';
import { attachmentsSchema, type TAttachment, type TMessage } from '~/types/chat';
import { Tree, type TTree } from '~/utils/tree';

const CHAT_STATE_LOCALFORAGE_KEY = 'rllm:chat-state';

type TChatState = {
  attachments: TAttachment[];
  feedbackEnabled: boolean;
  messages: TTree<TMessage>;
  path: number[];
  prompt: string;
  settings: Option<TChatSettings>;
};

const makeDefaultChatState: () => TChatState = () => ({
  attachments: [],
  feedbackEnabled: false,
  messages: new Tree(),
  path: [],
  prompt: '',
  settings: Option.None()
});

export const [chatState, setChatState] = makePersisted(
  // oxlint-disable-next-line solid/reactivity
  createStore(makeDefaultChatState()),
  {
    deserialize: (data) => {
      const result = safeParseJson(data, {
        validate: z.object({
          attachments: z.array(attachmentsSchema),
          feedbackEnabled: z.boolean(),
          prompt: z.string()
        }).parse
      });
      if (result.isErr()) {
        return makeDefaultChatState();
      }
      return Object.assign(makeDefaultChatState(), result.unwrap());
    },
    name: CHAT_STATE_LOCALFORAGE_KEY,
    serialize: (data) =>
      JSON.stringify({
        attachments: data.attachments,
        feedbackEnabled: data.feedbackEnabled,
        prompt: data.prompt
      }),
    storage: localforage
  }
);

export function resetChatState() {
  setChatState(makeDefaultChatState());
  localforage.removeItem(CHAT_STATE_LOCALFORAGE_KEY);
}

export function updateChatSettings(settings: z.input<typeof chatSettingsSchema>) {
  setChatState((state) =>
    produce(state, (draft) => {
      draft.settings = Option.Some(chatSettingsSchema.parse(settings));
    })
  );
}
export function updateMessages(
  setter:
    | (({ messages, path }: { messages: TTree<TMessage>; path: number[] }) => {
        messages?: TTree<TMessage>;
        path?: number[];
      })
    | {
        messages?: TTree<TMessage>;
        path?: number[];
      }
) {
  const { messages, path } =
    typeof setter === 'function'
      ? setter({ messages: chatState.messages, path: chatState.path })
      : setter;
  setChatState((state) =>
    produce(state, (draft) => {
      if (messages !== undefined) {
        draft.messages = messages;
      }
      if (path !== undefined) {
        draft.path = path;
      }
    })
  );
}

export function updatePrompt(prompt: string) {
  setChatState((state) =>
    produce(state, (draft) => {
      draft.prompt = prompt;
    })
  );
}

export function addAttachment(attachment: TAttachment) {
  setChatState((state) =>
    produce(state, (draft) => {
      draft.attachments.push(attachment);
    })
  );
}

export function removeAttachmentById(id: string) {
  setChatState((state) =>
    produce(state, (draft) => {
      const index = draft.attachments.findIndex((a) => a.id === id);
      if (index === -1) return;
      draft.attachments.splice(index, 1);
    })
  );
}

export function updateAttachmentById(id: string, data: Partial<TAttachment>) {
  setChatState((state) =>
    produce(state, (draft) => {
      const index = draft.attachments.findIndex((a) => a.id === id);
      if (index === -1) return;
      Object.assign(draft.attachments[index], data);
    })
  );
}

export function updateFeedbackEnabled(feedbackEnabled: boolean) {
  setChatState((state) =>
    produce(state, (draft) => {
      draft.feedbackEnabled = feedbackEnabled;
    })
  );
}
