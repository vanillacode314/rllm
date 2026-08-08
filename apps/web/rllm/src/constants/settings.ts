import * as z from 'zod/mini';

import { env } from '~/utils/env';

type Page = { condition?: () => boolean; icon?: string; name: string; path: string };

export const SETTINGS_PAGES = Object.freeze([
  {
    icon: 'icon-[heroicons--adjustments-horizontal]',
    name: 'General',
    path: '/settings/general'
  },
  {
    condition: () => !!env.VITE_SYNC_SERVER_BASE_URL,
    icon: 'icon-[heroicons--user-circle]',
    name: 'Account',
    path: '/settings/account'
  },
  {
    icon: 'icon-[heroicons--cloud]',
    name: 'Providers',
    path: '/settings/providers'
  },
  {
    icon: 'icon-[heroicons--server-stack]',
    name: 'MCP',
    path: '/settings/mcp'
  },
  {
    name: 'Proxy',
    path: '/settings/proxy'
  },
  // {
  // 	name: 'Storage',
  // 	icon: 'icon-[heroicons--folder]',
  // 	path: '/settings/storage'
  // },
  {
    icon: 'icon-[heroicons--document]',
    name: 'Data',
    path: '/settings/data'
  },
  {
    icon: 'icon-[heroicons--swatch]',
    name: 'Appearance',
    path: '/settings/appearance'
  },
  {
    icon: 'icon-[heroicons--puzzle-piece]',
    name: 'Models',
    path: '/settings/models'
  }
] satisfies Page[]);

export const STARTUP_PAGE_OPTIONS = [
  { label: 'Last Chat', value: 'last-chat' },
  { label: 'New Chat', value: 'new-chat' },
  { label: 'Scratchpad', value: 'scratchpad' }
] satisfies Array<{ label: string; value: string }>;
export const STARTUP_PAGE_VALUES = Object.freeze(
  STARTUP_PAGE_OPTIONS.map((option) => option.value)
);
export type TStartupPage = (typeof STARTUP_PAGE_VALUES)[number];

export const lastOpenedPageSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), title: z.string(), type: z.literal('chat') }),
  z.object({ type: z.literal('new-chat') }),
  z.object({ type: z.literal('scratchpad') })
]);
