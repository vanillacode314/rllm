import { createFileRoute, useRouter } from '@tanstack/solid-router';
import { z } from 'zod/mini';

import { useAppDrawer } from '~/components/AppDrawer';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { db } from '~/db/client';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { createTask } from '~/lib/background-task-manager/tasks';
import { slugify } from '~/utils/string';
import { Tree } from '~/utils/tree';

import ChatAppDrawer from './-ChatAppDrawer';
import { useChatPage, useChatPageBeforeLoad, useChatPageLoader } from './-layout';
import { updateMessages } from './-state';

console.error('FIX OPTIMIZE STORAGE');

export const Route = createFileRoute('/(chat)/scratchpad')({
  beforeLoad: useChatPageBeforeLoad,
  component: ScratchpadPageComponent,
  loader: async ({ preload }) => {
    const { makeNewChat, ensureQueryData, ensureValidChatProvider, loadChat } = useChatPageLoader({
      preload,
      scratchpad: true
    });
    let { scratchpad } = await ensureQueryData();
    const isNewChat = scratchpad === null;
    if (isNewChat) {
      const chat = await makeNewChat();
      loadChat(chat);
      return { chat, isNewChat };
    }

    scratchpad = await ensureValidChatProvider(scratchpad!);
    loadChat(scratchpad);

    return {
      chat: scratchpad,
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

  const { chat, ChatPage } = useChatPage(() => ({
    id: loaderData().chat.id,
    isNewChat: loaderData().isNewChat,
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
    await db.userMetadata.deleteScratchpadChat();
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
