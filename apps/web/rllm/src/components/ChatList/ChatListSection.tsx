import { ReactiveSet } from '@solid-primitives/set';
import { createDebouncer } from '@tanstack/solid-pacer';
import { useInfiniteQuery, useQuery } from '@tanstack/solid-query';
import { useLocation } from '@tanstack/solid-router';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { toast } from 'solid-sonner';

import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { usePromptDialog } from '~/components/modals/auto-import/PromptDialog';
import { Badge } from 'ui/badge';
import { SidebarGroupLabel, SidebarMenu } from 'ui/sidebar';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { isChatOpen } from '~/utils/chat';
import { produce } from '~/utils/immer';
import { createDerivedStore } from '~/utils/stores';
import { cn } from 'ui/utils/tailwind';

import { ChatListHeader } from './ChatListHeader';
import { ChatListItem } from './ChatListItem';

export interface ChatListSectionProps {
  class?: string;
  onClose: () => void;
  scrollRef?: HTMLElement | null;
  showGroupLabel?: boolean;
  sizePx?: number;
}

const [filterState, setFilterState] = createStore<{ query: string; tags: Set<string> }>({
  query: '',
  tags: new ReactiveSet()
});
export function ChatListSection(props: ChatListSectionProps) {
  const location = useLocation();

  const updateQuery = createDebouncer(
    (query: string) => {
      setFilterState('query', query);
    },
    { wait: 100 }
  );
  const chatsQuery = useInfiniteQuery(() =>
    queries.chats
      .all()
      ._ctx.pagedMinimal({ query: filterState.query, tags: Array.from(filterState.tags) })
  );
  const chats = createDerivedStore(
    () => [chatsQuery.isPending, chatsQuery.isSuccess ? chatsQuery.data.pages.flat() : []],
    ([isPending, current], prev) =>
      isPending && current.length === 0 && prev !== undefined ? prev : current,
    {
      key: 'id'
    }
  );
  const totalCountQuery = useQuery(() => queries.chats.all()._ctx.count());
  const loadedCount = () => chats.length;
  const totalCount = () => totalCountQuery.data ?? 0;

  const [localScrollRef, setLocalScrollRef] = createSignal<HTMLUListElement | null>(null);
  const scrollRef = createMemo(() => (props.scrollRef ? props.scrollRef : localScrollRef()));

  const virtualizer = createMemo(() => {
    void scrollRef();
    return createVirtualizer({
      count: totalCount(),
      estimateSize: () => 36,
      getItemKey: (index) => (chats.length <= index ? index : chats[index]!.id),
      getScrollElement: () => (scrollRef()?.isConnected ? scrollRef() : null),
      overscan: 5
    });
  });

  const virtualItems = () => virtualizer().getVirtualItems();
  const totalSize = () => ('sizePx' in props ? props.sizePx : virtualizer().getTotalSize());

  async function renameChat(id: string) {
    const promptDialog = usePromptDialog();
    const title = await promptDialog.prompt({
      description: 'Enter a new title for this chat',
      title: 'Rename Chat'
    });
    if (!title) return;
    await logger.dispatch({
      data: { id, title },
      type: 'updateChat'
    });
  }

  async function deleteChat(id: string, shouldConfirm: boolean = true) {
    const confirmDialog = useConfirmDialog();
    const chat = () => chats.find((c) => c.id === id);
    const yes =
      !shouldConfirm ||
      (await confirmDialog.confirm({
        confirmText: 'Delete',
        description: `Are you sure you want to delete this chat? "${chat()?.title}"`,
        onConfirm: () => logger.dispatch({ data: { id }, type: 'deleteChat' }),
        title: 'Delete Chat',
        variant: 'destructive'
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
    <div class={cn('overflow-hidden flex flex-col', props.class)}>
      <Show when={props.showGroupLabel}>
        <SidebarGroupLabel class="pr-2 shrink-0 flex gap-1 items-center">
          <ChatListHeader
            isLoading={chatsQuery.isFetchingNextPage}
            loadedCount={loadedCount()}
            totalCount={totalCount()}
          />
        </SidebarGroupLabel>
      </Show>
      <div class="flex flex-col gap-2 border-input border rounded-md p-2 focus-within:ring-2 focus-within:ring-ring text-xs mb-2">
        <input
          aria-label="filter chats by tags or title"
          class="outline-none"
          onInput={(event) => updateQuery.maybeExecute(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              updateQuery.flush();
              const value = filterState.query.trim().toLowerCase();
              if (!value) return;
              if (filterState.tags.has(value)) {
                toast.info(`Tag "${value}" already exists`);
                return;
              }
              setFilterState((filterState) => {
                filterState.tags.add(value);
                return produce(filterState, (filterState) => {
                  filterState.query = '';
                });
              });
            }
          }}
          placeholder="filter chats by tags or title"
          value={filterState.query}
        />
        <Show when={filterState.tags.size > 0}>
          <div class="flex flex-wrap gap-1">
            <For each={Array.from(filterState.tags.values())}>
              {(tag) => (
                <Badge class="text-xs" variant="secondary">
                  <span>{tag}</span>
                  <button
                    class="ml-1 flex gap-1 items-center"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      filterState.tags.delete(tag);
                    }}
                  >
                    <span class="sr-only">Remove Tag {tag}</span>
                    <span class="icon-[heroicons--x-mark-16-solid]" />
                  </button>
                </Badge>
              )}
            </For>
            <Badge class="text-xs" variant="outline">
              <button
                class="flex gap-1 items-center"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setFilterState('tags', new ReactiveSet());
                }}
              >
                <span>clear all</span>
                <span class="icon-[heroicons--x-mark-16-solid]" />
              </button>
            </Badge>
          </div>
        </Show>
      </div>
      <SidebarMenu class="overflow-y-auto pr-2" ref={setLocalScrollRef}>
        <div style={{ height: `${totalSize()}px`, position: 'relative' }}>
          <For each={virtualItems()}>
            {(virtualRow) => {
              const chat = () => chats[virtualRow.index];
              return (
                <Show when={chat()}>
                  <div
                    style={{
                      left: 0,
                      position: 'absolute',
                      top: 0,
                      transform: `translateY(${virtualRow.start}px)`,
                      width: '100%'
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
