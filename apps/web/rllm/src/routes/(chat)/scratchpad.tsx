import { createFileRoute, useRouter } from '@tanstack/solid-router';
import { HLC } from 'hlc';
import { nanoid } from 'nanoid';
import { createRenderEffect, onMount, untrack } from 'solid-js';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import { z } from 'zod/mini';

import type { TMessage } from '~/types/chat';

import { useAppDrawer } from '~/components/AppDrawer';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { FALLBACK_CHAT_SETTINGS } from '~/constants/chat-settings';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { chatsSchema } from '~/db/app-schema';
import { logger } from '~/db/client';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { createTask } from '~/lib/background-task-manager/tasks';
import { fetchers } from '~/queries';
import { slugify } from '~/utils/string';
import { Tree } from '~/utils/tree';

import ChatAppDrawer from './-ChatAppDrawer';
import { useChatPage, useChatPageBeforeLoad, useChatPageLoader } from './-layout';
import { updateMessages } from './-state';
import { getLatestPath } from './-utils';

console.error('FIX OPTIMIZE STORAGE');

export const Route = createFileRoute('/(chat)/scratchpad')({
  beforeLoad: useChatPageBeforeLoad,
  component: ScratchpadPageComponent,
  // oxlint-disable-next-line perfectionist/sort-objects
  loader: async () => {
    const { ensureQueryData, ensureValidChatProvider } = useChatPageLoader({ scratchpad: true });
    const { defaultChatSettingsPreset, providers, scratchpad } = await ensureQueryData();
    const jsonChat = Option.from(scratchpad);
    const isNewChat = jsonChat.isNone();
    let chat = await jsonChat
      .okOrElse(() => new Error('No chat found'))
      .andThen((value) => safeParseJson(value, { validate: chatsSchema.parse }))
      .toAsync()
      .unwrapOrElse(async () => {
        const chatSettings = FALLBACK_CHAT_SETTINGS(
          providers[0].defaultModelIds[0],
          providers[0].id
        );
        if (defaultChatSettingsPreset) {
          const preset = await fetchers.chatPresets.byId(defaultChatSettingsPreset);
          Object.assign(chatSettings, preset.settings);
        }
        const clientId = await logger.getClientId();
        const now = HLC.generate(clientId);
        return {
          accessCount: 0,
          createdAt: now.toString(),
          finished: true,
          id: nanoid(),
          lastAccessedAt: null,
          messages: new Tree<TMessage>().toJSON(),
          settings: chatSettings,
          tags: [],
          title: 'Untitled New Chat',
          updatedAt: {}
        };
      });

    chat = await ensureValidChatProvider(chat);

    return {
      chat,
      chatSettings: chat.settings,
      id: chat.id,
      isNewChat
    };
  },
  validateSearch: z.object({ id: z.optional(z.string()) })
});

function ScratchpadPageComponent() {
  const appDrawer = useAppDrawer();
  appDrawer.setContent(ChatAppDrawer);
  const router = useRouter();
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  function initChat() {
    const messages = loaderData().chat.messages ?? { children: [], value: null };
    const tree = Tree.fromJSON<TMessage>(messages);
    updateMessages({ messages: tree, path: getLatestPath(tree) });
  }
  createRenderEffect(() => untrack(initChat));
  const { chat, ChatPage } = useChatPage(() => ({
    chatSettings: loaderData().chatSettings,
    id: loaderData().id,
    isNewChat: loaderData().isNewChat,
    loaderChat: loaderData().chat,
    navigate,
    scratchpad: true
  }));

  const confirmDialog = useConfirmDialog();

  async function onReset() {
    const yes = await confirmDialog.confirm({
      description: 'Are you sure you want to reset this chat? This action cannot be undone.',
      title: 'Reset Chat',
      variant: 'destructive'
    });
    if (!yes) return;
    updateMessages({ messages: new Tree(), path: [] });
    await logger.dispatch({
      data: { id: USER_METADATA_KEYS.SCRATCHPAD_CHAT },
      dontLog: true,
      type: 'deleteUserMetadata'
    });
    await router.invalidate();
  }

  async function onSave() {
    const { promise } = await BackgroundTaskManager.scheduleTask(
      createTask({ type: 'saveScratchpadChat' }, 'immediate')
    );
    await promise;
    await navigate({
      params: { _splat: slugify(chat().title) },
      replace: true,
      search: { id: chat().id },
      to: '/chat/$'
    });
  }

  return <ChatPage onReset={onReset} onSave={onSave} />;
}
