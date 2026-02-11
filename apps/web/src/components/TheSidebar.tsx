import { createKeyHold } from '@solid-primitives/keyboard';
import { useInfiniteQuery, useQuery } from '@tanstack/solid-query';
import { Link, type ParsedLocation, useLocation, useNavigate } from '@tanstack/solid-router';
import { createVirtualizer } from '@tanstack/solid-virtual';
import { Gesture } from '@use-gesture/vanilla';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';

import type { TChat } from '~/types/chat';

import { useNotifications } from '~/context/notifications';
import { logger } from '~/db/client';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { queries } from '~/queries';
import { isMobile } from '~/signals';
import { slugify } from '~/utils/string';

import { useConfirmDialog } from './modals/auto-import/ConfirmDialog';
import { usePromptDialog } from './modals/auto-import/PromptDialog';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from './ui/sidebar';

const isChatOpen = (location: ParsedLocation, chatId: string) => {
  return (
    location.pathname.startsWith('/chat/') &&
    'id' in location.search &&
    location.search.id === chatId
  );
};

export function TheSidebar() {
  const links = [
    {
      title: 'New Chat',
      navigate: { to: '/chat/$', params: { _splat: 'new' }, search: { id: undefined } },
      icon: 'icon-[heroicons--plus-circle]'
    },
    {
      title: 'Presets',
      navigate: { to: '/presets' },
      icon: 'icon-[heroicons--puzzle-piece]'
    },
    {
      title: 'Settings',
      navigate: { to: '/settings' },
      icon: 'icon-[heroicons--cog]'
    }
  ];

  const location = useLocation();

  const chatsQuery = useInfiniteQuery(() => queries.chats.all()._ctx.pagedMinimal());
  const chats = createMemo(() => (chatsQuery.isSuccess ? chatsQuery.data.pages.flat() : []));
  const totalCountQuery = useQuery(() => queries.chats.all()._ctx.count());
  const loadedCount = () => chats().length;
  const totalCount = () => totalCountQuery.data ?? 0;
  const currentChatIndex = () => chats().findIndex((chat) => isChatOpen(location(), chat.id));

  const [scrollRef, setScrollRef] = createSignal<HTMLUListElement | null>(null);

  const virtualizer = createMemo(() => {
    void scrollRef();
    return createVirtualizer({
      count: totalCount(),
      getScrollElement: () => (scrollRef()?.isConnected ? scrollRef() : null),
      estimateSize: () => 36,
      overscan: 5
    });
  });

  const virtualItems = () => virtualizer().getVirtualItems();
  const totalSize = () => virtualizer().getTotalSize();

  function registerInfiniteScrollDetector() {
    createEffect(() => {
      const items = virtualItems();
      if (!items.length) return;
      const lastItem = items[items.length - 1];
      if (
        lastItem.index >= chats().length &&
        chatsQuery.hasNextPage &&
        !chatsQuery.isFetchingNextPage
      ) {
        chatsQuery.fetchNextPage();
      }
    });
  }
  registerInfiniteScrollDetector();

  const sidebar = useSidebar();

  const [notifications] = useNotifications();

  return (
    <>
      <button
        class="fixed w-8 h-60 bg-transparent top-10 left-0 z-30 touch-none"
        inert={sidebar.openMobile() || !isMobile()}
        ref={(el) => {
          const gesture = new Gesture(el, {
            onDrag: ({ swipe: [x, _y] }) => {
              if (x > 0) {
                sidebar.setOpenMobile(true);
              }
            }
          });
          onCleanup(() => gesture.destroy());
        }}
      />
      <Sidebar class="[view-transition-name:sidebar]">
        <SidebarHeader class="grid sm:grid-cols-[1fr_auto_auto] items-center p-4">
          <h3 class="font-bold tracking-wider text-lg">RLLM</h3>
          <span class="max-sm:hidden bg-muted py-1 px-2 rounded-md text-xs font-semibold tracking-widest text-muted-foreground border hover:border-primary transition-colors">
            Ctrl + K
          </span>
          <SidebarTrigger class="max-sm:hidden" />
        </SidebarHeader>
        <SidebarContent class="overflow-y-hidden">
          <SidebarGroup class="pb-0">
            <SidebarGroupContent>
              <SidebarMenu>
                <For each={links}>
                  {(item) => (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        activeProps={{ class: 'font-bold' }}
                        as={Link}
                        {...item.navigate}
                        onClick={() => sidebar.setOpenMobile(false)}
                      >
                        <span class={`${item.icon} text-lg`} />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </For>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup class="pr-0 overflow-hidden flex flex-col min-h-0">
            <SidebarGroupLabel class="pr-2 shrink-0 flex gap-1 items-center">
              <span>Chats</span>
              <Show when={totalCount() > 0 && !totalCountQuery.isLoading}>
                <span>
                  ({loadedCount()}/{totalCount()})
                </span>
              </Show>
              <Show when={chatsQuery.isFetchingNextPage}>
                <div class="flex justify-center py-2">
                  <span class="icon-[svg-spinners--90-ring-with-bg]" />
                </div>
              </Show>
            </SidebarGroupLabel>
            <SidebarMenu class="overflow-y-auto pr-2" ref={setScrollRef}>
              <div style={{ height: `${totalSize()}px`, position: 'relative' }}>
                <For each={virtualItems()}>
                  {(virtualRow) => {
                    const chat = () => chats()[virtualRow.index];
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
                          <ChatMenuItem
                            chat={chat()!}
                            currentChatIndex={currentChatIndex()}
                            index={virtualRow.index}
                          />
                        </div>
                      </Show>
                    );
                  }}
                </For>
              </div>
            </SidebarMenu>
          </SidebarGroup>
          <Show when={notifications.length > 0}>
            <span class="grow" />
            <SidebarGroup>
              <SidebarMenu>
                <For each={notifications}>
                  {(notification) => (
                    <SidebarMenuItem class="px-2 text-sm flex gap-2 items-center">
                      <span class="icon-[svg-spinners--90-ring-with-bg]" />
                      <span>{notification.content}</span>
                    </SidebarMenuItem>
                  )}
                </For>
              </SidebarMenu>
            </SidebarGroup>
          </Show>
        </SidebarContent>
        <SidebarFooter />
      </Sidebar>
    </>
  );
}

function ChatMenuItem(props: {
  chat: Pick<TChat, 'id' | 'tags' | 'title'>;
  currentChatIndex: number;
  index: number;
}) {
  const location = useLocation();
  const sidebar = useSidebar();
  const navigate = useNavigate();
  const shiftKeyHeld = createKeyHold('Shift', { preventDefault: false });
  const isPending = ChatGenerationManager.createIsPending(() => props.chat.id);
  const confirmDialog = useConfirmDialog();
  const promptDialog = usePromptDialog();

  async function renameChat(id: string) {
    const title = await promptDialog.prompt({
      title: 'Rename Chat',
      description: 'Enter a new title for this chat'
    });
    if (!title) return;
    await logger.dispatch({
      type: 'updateChat',
      data: { id, title }
    });
    if (isChatOpen(location(), id)) {
      await navigate({
        to: '/chat/$',
        params: { _splat: slugify(title) },
        search: { id }
      });
    }
  }

  async function deleteChat(id: string, shouldConfirm: boolean = true) {
    const yes =
      !shouldConfirm ||
      (await confirmDialog.confirm({
        title: 'Delete Chat',
        description: 'Are you sure you want to delete this chat?'
      }));
    if (!yes) return;
    await logger.dispatch({
      type: 'deleteChat',
      data: { id }
    });
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        activeProps={{ class: 'font-bold bg-muted' }}
        as={Link}
        isActive={isChatOpen(location(), props.chat.id)}
        onClick={() => sidebar.setOpenMobile(false)}
        params={{ _splat: slugify(props.chat.title) }}
        preload="intent"
        search={{ id: props.chat.id }}
        title={props.chat.title}
        to="/chat/$"
        viewTransition={{
          types: props.currentChatIndex < props.index ? ['slide-right'] : ['slide-left']
        }}
      >
        {/* <span class="icon-[heroicons--chat-bubble-bottom-center-text] text-lg shrink-0" /> */}
        <span class="truncate">{props.chat.title}</span>
      </SidebarMenuButton>
      <Show
        fallback={
          <div class="absolute right-1 top-1.5 grid place-content-center w-5 aspect-square">
            <span class="icon-[svg-spinners--90-ring-with-bg]" />
          </div>
        }
        when={!isPending()}
      >
        <Show
          fallback={
            <div class="flex gap-2 items-center text-sm">
              <SidebarMenuAction onClick={() => deleteChat(props.chat.id, false)}>
                <span class="icon-[heroicons--trash]" />
              </SidebarMenuAction>
              <SidebarMenuAction class="right-6" onClick={() => renameChat(props.chat.id)}>
                <span class="icon-[heroicons--pencil]" />
              </SidebarMenuAction>
            </div>
          }
          when={!shiftKeyHeld()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger as={SidebarMenuAction}>
              <span class="icon-[heroicons--ellipsis-horizontal]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <Show when={props.chat.tags.length > 0}>
                <div class="flex gap-1 max-w-36 overflow-x-auto">
                  <For each={props.chat.tags}>
                    {(tag) => (
                      <Badge class="whitespace-nowrap" variant="secondary">
                        {tag}
                      </Badge>
                    )}
                  </For>
                </div>
              </Show>
              <DropdownMenuItem onSelect={() => renameChat(props.chat.id)}>
                <span>Rename</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => deleteChat(props.chat.id)}>
                <span>Delete Chat</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Show>
      </Show>
    </SidebarMenuItem>
  );
}

export default TheSidebar;
