import { Link } from '@tanstack/solid-router';
import { For } from 'solid-js';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from 'ui/sidebar';

export interface QuickActionsSectionProps {
  class?: string;
  onClose: () => void;
}

const links = [
  {
    icon: 'icon-[heroicons--plus-circle]',
    title: 'New Chat',
    to: '/chat/new'
  },
  {
    icon: 'icon-[heroicons--puzzle-piece]',
    title: 'Presets',
    to: '/presets'
  },
  {
    icon: 'icon-[heroicons--cog]',
    title: 'Settings',
    to: '/settings'
  },
  {
    icon: 'icon-[heroicons--document]',
    title: 'Scratchpad',
    to: '/scratchpad'
  }
];

export function QuickActionsSection(props: QuickActionsSectionProps) {
  return (
    <SidebarMenu class={props.class}>
      <For each={links}>
        {(item) => (
          <SidebarMenuItem>
            <SidebarMenuButton
              activeProps={{ class: 'font-bold' }}
              as={Link}
              onClick={props.onClose}
              to={item.to}
            >
              <span class={`${item.icon} text-lg`} />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </For>
    </SidebarMenu>
  );
}
