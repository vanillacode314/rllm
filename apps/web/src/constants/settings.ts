import { env } from '~/utils/env';

type Page = { condition?: () => boolean; icon?: string; name: string; path: string };

const SETTINGS_PAGES: Page[] = [
	{
		name: 'Account',
		icon: 'icon-[heroicons--user-circle]',
		path: '/settings/account',
		condition: () => !!env.VITE_SYNC_SERVER_BASE_URL
	},
	{
		name: 'Providers',
		icon: 'icon-[heroicons--cloud]',
		path: '/settings/providers'
	},
	{
		name: 'MCP',
		icon: 'icon-[heroicons--server-stack]',
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
		name: 'Data',
		icon: 'icon-[heroicons--document]',
		path: '/settings/data'
	},
	{
		name: 'Appearance',
		icon: 'icon-[heroicons--swatch]',
		path: '/settings/appearance'
	},
	{
		name: 'Models',
		icon: 'icon-[heroicons--puzzle-piece]',
		path: '/settings/models'
	},
	{
		name: 'Debug',
		icon: 'icon-[heroicons--bug-ant]',
		path: '/settings/debug'
	}
];

export { SETTINGS_PAGES };
