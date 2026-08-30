import { useQuery } from '@tanstack/solid-query';
import { useLocation, useMatchRoute } from '@tanstack/solid-router';
import { createMemo, untrack } from 'solid-js';
import { queries } from '~/queries';

export function useChatState() {
  const matchRoute = useMatchRoute();
  const location = useLocation();
  const isChatRoute = matchRoute({
    to: '/chat/$'
  });
  const isNewChatRoute = createMemo(() => {
    const $isChatRoute = isChatRoute();
    return untrack(() => {
      if (!$isChatRoute) return false;
      return $isChatRoute._splat === 'new';
    });
  });
  const isScratchpadRoute = matchRoute({
    to: '/scratchpad'
  });
  const currentChat = useQuery(() => {
    const id = location().search.id as string;
    return {
      ...queries.chats.byId(id || ''),
      enabled: !!isChatRoute() && !isNewChatRoute() && id !== undefined
    };
  });

  return {
    get isNewChatRoute() {
      return !!isNewChatRoute();
    },
    get isScratchpadRoute() {
      return !!isScratchpadRoute();
    },
    get currentChat() {
      return currentChat;
    },
    get currentChatId() {
      return isChatRoute() && !isNewChatRoute() ? location().search.id : undefined;
    }
  };
}
