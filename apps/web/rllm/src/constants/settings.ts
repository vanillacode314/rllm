import { env } from '~/utils/env';

type Page = { condition?: () => boolean; icon?: string; name: string; path: string };

const SETTINGS_PAGES: Page[] = [
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
    condition: () => env.VITE_MODE === 'web',
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
];

export { SETTINGS_PAGES };
