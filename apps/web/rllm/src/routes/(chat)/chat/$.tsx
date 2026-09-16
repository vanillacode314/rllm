import { createFileRoute, redirect, useRouter } from '@tanstack/solid-router';
import { nanoid } from 'nanoid';
import { onCleanup, onMount } from 'solid-js';
import { toast } from 'solid-sonner';
import { z } from 'zod/mini';

import { useAppDrawer } from '~/components/AppDrawer';
import { db, logger } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

import { ChatAppDrawer } from '../-ChatAppDrawer';
import { INCREMENT_ACCESS_COUNT_THRESHOLD_MILLISECONDS } from '../-constants';
import { useChatPage, useChatPageBeforeLoad, useChatPageLoader } from '../-layout';
import { updateMessages } from '../-state';
import { getLatestPath } from '../-utils';

console.error('FIX OPTIMIZE STORAGE');

export const Route = createFileRoute('/(chat)/chat/$')({
  beforeLoad: useChatPageBeforeLoad,
  component: ChatPageComponent,
  loaderDeps: ({ search: { id } }) => ({ id: id ?? nanoid(), isNewChat: id === undefined }),
  // oxlint-disable-next-line perfectionist/sort-objects
  loader: async ({ deps, params, preload }) => {
    const { ensureQueryData, ensureValidChatProvider, loadChat, makeNewChat } = useChatPageLoader({
      preload
    });
    const { id, isNewChat } = deps;
    if (isNewChat && params._splat !== 'new')
      throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });

    await ensureQueryData();

    if (isNewChat) {
      const chat = await makeNewChat();
      loadChat(chat);
      return { chat, isNewChat };
    }
    let chat = await queryClient.fetchQuery(queries.chats.get(id));
    if (chat === null) throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });
    chat = await ensureValidChatProvider(chat);
    loadChat(chat);

    return {
      chat,
      isNewChat
    };
  },
  remountDeps: () => 'chat-page',
  validateSearch: z.object({ id: z.optional(z.string()) })
});

function ChatPageComponent() {
  const appDrawer = useAppDrawer();
  appDrawer.setContent(ChatAppDrawer);
  const router = useRouter();
  const searchParams = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const { ChatPage } = useChatPage(() => ({
    id: loaderData().chat?.id ?? '',
    isNewChat: loaderData().isNewChat,
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
    await db.chats.incrementAccessCount(id);
  });
  onMount(() => {
    onCleanup(
      logger.on(
        'deleteChat',
        async (event) => {
          if (event.id !== loaderData().chat.id) return;
          navigate({ params: { _splat: 'new' }, to: '/chat/$' });
        },
        { self: true }
      )
    );
    onCleanup(
      logger.on('updateChat', async (event) => {
        if (event.id !== loaderData().chat.id) return;
        toast.info('Chat updated', {
          action: {
            label: 'Reload',
            onClick: async () => {
              await router.invalidate();
              updateMessages(({ messages }) => ({ path: getLatestPath(messages) }));
            }
          },
          duration: Number.POSITIVE_INFINITY,
          id: `updateChat-${loaderData().chat.id}`
        });
      })
    );
  });

  return <ChatPage />;
}
