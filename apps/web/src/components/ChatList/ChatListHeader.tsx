import { Show } from 'solid-js';

interface ChatListHeaderProps {
  totalCount: number;
  loadedCount: number;
  isLoading: boolean;
}

export function ChatListHeader(props: ChatListHeaderProps) {
  return (
    <div class="pr-2 shrink-0 flex gap-1 items-center">
      <span>Chats</span>
      <Show when={props.totalCount > 0 && !props.isLoading}>
        <span>({props.loadedCount}/{props.totalCount})</span>
      </Show>
      <Show when={props.isLoading}>
        <div class="flex justify-center py-2">
          <span class="icon-[svg-spinners--90-ring-with-bg]" />
        </div>
      </Show>
    </div>
  );
}