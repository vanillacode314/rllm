import { Link } from '@tanstack/solid-router';
import { Show } from 'solid-js';
import { For } from 'solid-js';

import type { TChat } from '~/types/chat';

import { Badge } from 'ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'ui/dropdown-menu';
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from 'ui/sidebar';
import { ChatGenerationManager } from '~/lib/chat/generation';

export interface ChatListItemProps {
  chat: Pick<TChat, 'id' | 'tags' | 'title'>;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  onRename: () => void;
}

export function ChatListItem(props: ChatListItemProps) {
  const isPending = ChatGenerationManager.createIsPending(() => props.chat.id);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        activeProps={{ class: 'font-bold bg-muted' }}
        as={Link}
        isActive={props.isActive}
        onClick={props.onClick}
        // @ts-expect-error - search param workaround
        search={{ id: props.chat.id }}
        title={props.chat.title}
        to="/chat/$"
      >
        <span class="truncate">{props.chat.title}</span>
      </SidebarMenuButton>

      <Show when={!isPending()}>
        <DropdownMenu>
          <DropdownMenuTrigger as={SidebarMenuAction}>
            <span class="icon-[heroicons--ellipsis-horizontal]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <Show when={props.chat.tags.length > 0}>
              <div class="flex gap-1 max-w-36 overflow-x-auto">
                <For each={props.chat.tags}>
                  {(tag) => <Badge variant="secondary">{tag}</Badge>}
                </For>
              </div>
            </Show>
            <DropdownMenuItem onSelect={props.onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={props.onDelete}>Delete Chat</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Show>

      <Show when={isPending()}>
        <div class="absolute right-1 top-1.5 grid place-content-center w-5 aspect-square">
          <span class="icon-[svg-spinners--90-ring-with-bg]" />
        </div>
      </Show>
    </SidebarMenuItem>
  );
}
