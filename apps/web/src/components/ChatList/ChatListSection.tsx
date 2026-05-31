import { createImmutable } from '@solid-primitives/immutable';
import { useInfiniteQuery, useQuery } from '@tanstack/solid-query';
import { useLocation } from '@tanstack/solid-router';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';

import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { usePromptDialog } from '~/components/modals/auto-import/PromptDialog';
import { SidebarGroupLabel, SidebarMenu } from '~/components/ui/sidebar';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { isChatOpen } from '~/utils/chat';

import { ChatListHeader } from './ChatListHeader';
import { ChatListItem } from './ChatListItem';

export interface ChatListSectionProps {
  onClose: () => void;
  scrollRef?: HTMLElement | null;
  showGroupLabel?: boolean;
  sizePx?: number;
}

export function ChatListSection(props: ChatListSectionProps) {
  const location = useLocation();

  const chatsQuery = useInfiniteQuery(() => queries.chats.all()._ctx.pagedMinimal());
  const chats = createImmutable(() => (chatsQuery.isSuccess ? chatsQuery.data.pages.flat() : []));
  const totalCountQuery = useQuery(() => queries.chats.all()._ctx.count());
  const loadedCount = () => chats.length;
  const totalCount = () => totalCountQuery.data ?? 0;

  const [localScrollRef, setLocalScrollRef] = createSignal<HTMLUListElement | null>(null);
  const scrollRef = createMemo(() => (props.scrollRef ? props.scrollRef : localScrollRef()));

  const virtualizer = createMemo(() => {
    void scrollRef();
    return createVirtualizer({
      count: totalCount(),
      getScrollElement: () => (scrollRef()?.isConnected ? scrollRef() : null),
      getItemKey: (index) => (chats.length <= index ? index : chats[index]!.id),
      estimateSize: () => 36,
      overscan: 5
    });
  });

  const virtualItems = () => virtualizer().getVirtualItems();
  const totalSize = () => ('sizePx' in props ? props.sizePx : virtualizer().getTotalSize());

  async function renameChat(id: string) {
    const promptDialog = usePromptDialog();
    const title = await promptDialog.prompt({
      title: 'Rename Chat',
      description: 'Enter a new title for this chat'
    });
    if (!title) return;
    await logger.dispatch({
      type: 'updateChat',
      data: { id, title }
    });
  }

  async function deleteChat(id: string, shouldConfirm: boolean = true) {
    const confirmDialog = useConfirmDialog();
    const chat = () => chats.find((c) => c.id === id);
    const yes =
      !shouldConfirm ||
      (await confirmDialog.confirm({
        title: 'Delete Chat',
        description: `Are you sure you want to delete this chat? "${chat()?.title}"`,
        confirmText: 'Delete',
        variant: 'destructive',
        onConfirm: () => logger.dispatch({ type: 'deleteChat', data: { id } })
      }));
    if (!yes) return;
  }

  function registerInfiniteScrollDetector() {
    createEffect(() => {
      const items = virtualItems();
      if (!items.length) return;
      const lastItem = items[items.length - 1];
      if (
        lastItem.index >= chats.length &&
        chatsQuery.hasNextPage &&
        !chatsQuery.isFetchingNextPage
      ) {
        chatsQuery.fetchNextPage();
      }
    });
  }

  registerInfiniteScrollDetector();

  return (
    <div class="overflow-hidden flex flex-col">
      <Show when={props.showGroupLabel}>
        <SidebarGroupLabel class="pr-2 shrink-0 flex gap-1 items-center">
          <ChatListHeader
            isLoading={chatsQuery.isFetchingNextPage}
            loadedCount={loadedCount()}
            totalCount={totalCount()}
          />
        </SidebarGroupLabel>
      </Show>

      <SidebarMenu class="overflow-y-auto pr-2" ref={setLocalScrollRef}>
        <div style={{ height: `${totalSize()}px`, position: 'relative' }}>
          <For each={virtualItems()}>
            {(virtualRow) => {
              const chat = () => chats[virtualRow.index];
              return (
                <Show when={chat()}>
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <ChatListItem
                      chat={chat()!}
                      isActive={isChatOpen(location(), chat()!.id)}
                      onClick={() => props.onClose()}
                      onDelete={() => deleteChat(chat()!.id)}
                      onRename={() => renameChat(chat()!.id)}
                    />
                  </div>
                </Show>
              );
            }}
          </For>
        </div>
      </SidebarMenu>
    </div>
  );
}
