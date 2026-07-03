import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createFileRoute, redirect, useRouter } from '@tanstack/solid-router';
import { nanoid } from 'nanoid';
import { onCleanup, onMount } from 'solid-js';
import { toast } from 'solid-sonner';
import { z } from 'zod/mini';

import { useAppDrawer } from '~/components/AppDrawer';
import { FALLBACK_CHAT_SETTINGS } from '~/constants/chat-settings';
import { logger } from '~/db/client';
import { fetchers, queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

import ChatAppDrawer from '../-ChatAppDrawer';
import { INCREMENT_ACCESS_COUNT_THRESHOLD_MILLISECONDS } from '../-constants';
import { useChatPage, useChatPageLoader } from '../-layout';
import { messages, setPrompt } from '../-state';
import { getLatestPath } from '../-utils';

console.error('FIX OPTIMIZE STORAGE');

export const Route = createFileRoute('/(chat)/chat/$')({
  beforeLoad: async () => {
    const numberOfProviders = await fetchers.providers.countProviders();
    if (numberOfProviders === 0) throw redirect({ to: '/settings/providers' });
  },
  component: ChatPageComponent,
  loaderDeps: ({ search: { id } }) => ({ id: id ?? nanoid(), isNewChat: id === undefined }),
  // oxlint-disable-next-line perfectionist/sort-objects
  loader: async ({ deps, params }) => {
    const { ensureQueryData, ensureValidChatProvider } = useChatPageLoader({});
    const { id, isNewChat } = deps;
    if (isNewChat && params._splat !== 'new')
      throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });

    const { defaultChatSettingsPreset, providers } = await ensureQueryData();

    if (isNewChat) {
      const chatSettings = FALLBACK_CHAT_SETTINGS(providers[0].defaultModelIds[0], providers[0].id);
      if (defaultChatSettingsPreset) {
        const preset = await fetchers.chatPresets.byId(defaultChatSettingsPreset);
        Object.assign(chatSettings, preset.settings);
      }
      return { chat: null, chatSettings, id, isNewChat };
    }

    let chat = await queryClient.fetchQuery(queries.chats.byId(id));
    if (chat === null) throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });
    chat = await ensureValidChatProvider(chat);

    return {
      chat,
      chatSettings: chat.settings,
      id: chat.id,
      isNewChat
    };
  },
  shouldReload: ({ deps }) => {
    const { isNewChat } = deps;
    if (isNewChat) return true;
    return undefined;
  },
  validateSearch: z.object({ id: z.optional(z.string()) })
});

function ChatPageComponent() {
  const appDrawer = useAppDrawer();
  appDrawer.setContent(ChatAppDrawer);
  const router = useRouter();
  const searchParams = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const { ChatPage, setCurrentPath } = useChatPage(() => ({
    chatSettings: loaderData().chatSettings,
    id: loaderData().id,
    isNewChat: loaderData().isNewChat,
    loaderChat: loaderData().chat,
    navigate
  }));

  onMount(async () => {
    const { chat, isNewChat } = loaderData();
    const id = searchParams().id;

    if (!id || isNewChat || !chat) return;

    const lastAccessedAt = chat.lastAccessedAt;
    if (
      typeof lastAccessedAt === 'number' &&
      Date.now() - lastAccessedAt < INCREMENT_ACCESS_COUNT_THRESHOLD_MILLISECONDS
    )
      return;
    await logger.dispatch({
      data: { id },
      type: 'incrementChatAccessCount'
    });
  });
  onMount(() => {
    onCleanup(
      logger.on(
        'deleteChat',
        async (event) => {
          if (event.id !== loaderData().id) return;
          navigate({ params: { _splat: 'new' }, to: '/chat/$' });
        },
        { self: true }
      )
    );
    onCleanup(
      logger.on('updateChat', async (event) => {
        if (event.id !== loaderData().id) return;
        toast.info('Chat updated', {
          action: {
            label: 'Reload',
            onClick: async () => {
              await router.invalidate();
              setCurrentPath(getLatestPath(messages()));
            }
          },
          duration: Number.POSITIVE_INFINITY,
          id: `updateChat-${loaderData().id}`
        });
      })
    );
  });
  createEventListenerMap(document, {
    'chat:handoff': (event: CustomEvent<{ prefilledPrompt: string }>) => {
      setPrompt(event.detail.prefilledPrompt);
      navigate({ params: { _splat: 'new' }, to: '/chat/$' });
    }
  });

  return <ChatPage />;
}
