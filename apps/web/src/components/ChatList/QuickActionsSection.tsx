import { Link } from '@tanstack/solid-router';
import { For } from 'solid-js';

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '~/components/ui/sidebar';

export interface QuickActionsSectionProps {
  onClose: () => void;
}

const links = [
  {
    title: 'New Chat',
    to: '/chat/new',
    icon: 'icon-[heroicons--plus-circle]'
  },
  {
    title: 'Presets',
    to: '/presets',
    icon: 'icon-[heroicons--puzzle-piece]'
  },
  {
    title: 'Settings',
    to: '/settings',
    icon: 'icon-[heroicons--cog]'
  }
];

export function QuickActionsSection(props: QuickActionsSectionProps) {
  return (
    <SidebarMenu>
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
