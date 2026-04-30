import { Gesture } from '@use-gesture/vanilla';
import { For, onCleanup, Show } from 'solid-js';

import { useNotifications } from '~/context/notifications';
import { isMobile } from '~/signals';

import { ChatListSection, QuickActionsSection } from './ChatList';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar
} from './ui/sidebar';

export function TheSidebar() {
  const sidebar = useSidebar();
  const [notifications] = useNotifications();

  return (
    <Sidebar class="[view-transition-name:sidebar] max-md:hidden">
      <SidebarHeader class="grid sm:grid-cols-[1fr_auto_auto] items-center p-4">
        <h3 class="font-bold tracking-wider text-lg">RLLM</h3>
        <span class="max-sm:hidden bg-muted py-1 px-2 rounded-md text-xs font-semibold tracking-widest text-muted-foreground border hover:border-primary transition-colors">
          Ctrl + K
        </span>
        <SidebarTrigger class="max-sm:hidden" />
      </SidebarHeader>
      <SidebarContent class="overflow-y-hidden">
        <SidebarGroup class="pb-0">
          <QuickActionsSection onClose={() => sidebar.setOpenMobile(false)}></QuickActionsSection>
        </SidebarGroup>

        <SidebarGroup class="overflow-hidden flex flex-col min-h-0">
          <ChatListSection onClose={() => sidebar.setOpenMobile(false)} showGroupLabel />
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
  );
}

export default TheSidebar;
