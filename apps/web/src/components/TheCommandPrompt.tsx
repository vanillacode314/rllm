import { createShortcut } from '@solid-primitives/keyboard';
import { useQuery } from '@tanstack/solid-query';
import {
	type ParsedLocation,
	useLocation,
	useMatchRoute,
	useNavigate,
	useRouter
} from '@tanstack/solid-router';
import { batch, createMemo, createSignal, For, Show } from 'solid-js';
import { toast } from 'solid-sonner';

import { SETTINGS_PAGES } from '~/constants/settings';
import { logger } from '~/db/client';
import { openAiAdapter } from '~/lib/adapters/openai';
import { updateChatSettings } from '~/lib/chat/settings';
import { queries } from '~/queries';
import { slugify } from '~/utils/string';

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator
} from './ui/command';

interface TItem {
	condition?: () => boolean;
	handler: (value: string) => Promise<void> | void;
	icon?: string;
	keywords?: string[];
	label: string;
	noClose?: boolean;
	value?: string;
}

const isChatOpen = (location: ParsedLocation, chatId: string) => {
	return (
		location.pathname.startsWith('/chat/') &&
		'id' in location.search &&
		location.search.id === chatId
	);
};

const [commandPromptOpen, setCommandPromptOpen] = createSignal<boolean>(false);

function TheCommandPrompt() {
	const [input, setInput] = createSignal<string>('');
	const mode = createMemo<'chats' | 'default' | 'models' | 'presets'>(() => {
		const trimmed = input().trimStart();
		if (trimmed.startsWith('#')) {
			return 'chats';
		}
		if (trimmed.startsWith('@')) {
			return 'models';
		}
		if (trimmed.startsWith(':')) {
			return 'presets';
		}
		return 'default';
	});

	createShortcut(['Control', 'k'], () => setCommandPromptOpen((open) => !open));
	createShortcut(['Meta', 'k'], () => setCommandPromptOpen((open) => !open));

	const navigate = useNavigate();
	const location = useLocation();
	const matchRoute = useMatchRoute();
	const isNewChatRoute = () => location().pathname.startsWith('/chat/new');
	const isChatRoute = matchRoute({
		to: '/chat/$'
	});
	const currentChat = useQuery(() => {
		const id = location().search.id as string;
		return {
			...queries.chats.byId(id || ''),
			enabled: Boolean(isChatRoute()) && id !== undefined
		};
	});
	const router = useRouter();

	const providers = useQuery(() => ({ ...queries.providers.all(), enabled: mode() === 'models' }));
	const proxyUrl = useQuery(() => ({
		...queries.userMetadata.byId('cors-proxy-url'),
		enabled: mode() === 'models'
	}));
	const proxifyUrl = (url: string) =>
		proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url;
	const fetchers = createMemo(() =>
		(providers.isSuccess ? providers.data : []).map((provider) => ({
			fetcher: openAiAdapter.makeFetcher(proxifyUrl(provider.baseUrl), provider.token),
			provider
		}))
	);
	const models = useQuery(() => ({
		queryKey: ['models', 'all'],
		queryFn: async ({ signal }) => {
			const models = await Promise.all(
				fetchers().map(async ({ fetcher, provider }) => {
					return {
						models: await openAiAdapter
							.fetchAllModels(fetcher, { signal })
							.unwrapOrElse(() => provider.defaultModelIds.map((id) => ({ id }))),
						provider
					};
				})
			);
			return models;
		},
		staleTime: 1000 * 60 * 30,
		enabled: fetchers().length > 0
	}));

	const chatsQuery = useQuery(() => ({ ...queries.chats.all(), enabled: mode() === 'chats' }));
	const chats = () => (chatsQuery.isSuccess ? chatsQuery.data : []);

	const presetsQuery = useQuery(() => ({
		...queries.chatPresets.all(),
		enabled: mode() === 'presets'
	}));
	const presets = () => (presetsQuery.isSuccess ? presetsQuery.data : []);

	const items = createMemo((): Record<string, TItem[]> => {
		switch (mode()) {
			case 'chats':
				return {
					'Goto Chat': chats().map((chat) => ({
						label: chat.title,
						handler: () => {
							navigate({
								to: '/chat/$',
								params: { _splat: slugify(chat.title) },
								search: { id: chat.id }
							});
						},
						keywords: [`#${chat.title}`],
						value: chat.id
					}))
				};
			case 'default':
				return {
					Actions: [
						{
							label: 'New Chat',
							icon: 'icon-[heroicons--plus-circle]',
							handler: () => navigate({ to: '/chat/$', params: { _splat: 'new' } }),
							condition: () => !isNewChatRoute()
						},
						{
							label:
								currentChat.isSuccess && currentChat.data ?
									`Delete Chat (${currentChat.data.title})`
								:	'Delete Chat',
							icon: 'icon-[heroicons--trash]',
							handler: () => deleteChat(location().search.id as string),
							condition: () => {
								if (!isChatRoute()) return false;
								const id = location().search.id;
								if (!id) return false;
								return isChatOpen(location(), id);
							}
						},
						{
							label:
								currentChat.isSuccess && currentChat.data ?
									`Rename Chat (${currentChat.data.title})`
								:	'Rename Chat',
							icon: 'icon-[heroicons--pencil-square]',
							handler: async () => {
								if (currentChat.isSuccess) {
									await renameChat(currentChat.data.id);
									await router.invalidate();
								} else toast.error('An Error Occured');
							},
							condition: () => {
								if (!isChatRoute()) return false;
								const id = location().search.id;
								if (!id) return false;
								return isChatOpen(location(), id);
							}
						}
					],
					Settings: SETTINGS_PAGES.map((page) => ({
						label: page.name,
						icon: page.icon ?? 'icon-[heroicons--cog-6-tooth]',
						handler: () => navigate({ href: page.path }),
						condition: () =>
							(page.condition?.() ?? true) && !location().pathname.startsWith(page.path)
					})),
					Default: []
				};
			case 'models':
				return {
					'Switch Model':
						models.isSuccess ?
							models.data.flatMap(({ models, provider }) =>
								models.map((model) => ({
									label: `${model.id} (${provider.name})`,
									handler: () => {
										updateChatSettings(
											{
												providerId: provider.id,
												modelId: model.id
											},
											location()
										);
									},
									keywords: [`@${model.id} ${provider.name}`],
									value: `${provider.id}/${model.id}`
								}))
							)
						:	[]
				};
			case 'presets':
				return {
					'Switch Preset': presets().map((preset) => ({
						label: preset.name,
						handler: () => {
							updateChatSettings(
								{
									providerId: preset.settings.providerId,
									modelId: preset.settings.modelId,
									systemPrompt: preset.settings.systemPrompt
								},
								location()
							);
						},
						keywords: [`:${preset.name}`],
						value: preset.id
					}))
				};
		}
	});

	async function renameChat(id: string) {
		const title = prompt('Enter a new title for this chat');
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

	async function deleteChat(id: string) {
		const yes = confirm('Are you sure you want to delete this chat?');
		if (!yes) return;
		if (isChatOpen(location(), id)) {
			await navigate({ to: '/chat/$', params: { _splat: 'new' } });
		}
		await logger.dispatch({
			type: 'deleteChat',
			data: { id }
		});
	}

	const filteredItems = createMemo(() =>
		Object.entries(items()).filter(([, items]) => items.some((item) => item.condition?.() ?? true))
	);

	return (
		<CommandDialog
			loop
			onOpenChange={(isOpen) => {
				setCommandPromptOpen(isOpen);
				if (!isOpen) setInput('');
			}}
			open={commandPromptOpen()}
		>
			<CommandInput
				onValueChange={(value) => setInput(value.trimStart())}
				placeholder="Type a command or search..."
				value={input()}
			/>
			<CommandList>
				<CommandEmpty>No actions left.</CommandEmpty>
				<For each={filteredItems()}>
					{([group, items], index) => {
						const refs = () => (
							<For each={items}>
								{(item) => (
									<Show when={item.condition?.() ?? true}>
										<CommandItem
											class="flex gap-1.5 items-center"
											keywords={item.keywords}
											onSelect={async (value) => {
												await item.handler(value);
												batch(() => {
													setInput('');
													if (item.noClose) return;
													setCommandPromptOpen(false);
												});
											}}
											value={item.value}
										>
											<Show when={item.icon}>
												<span class={item.icon} />
											</Show>
											<span>{item.label}</span>
										</CommandItem>
									</Show>
								)}
							</For>
						);

						return (
							<Show
								fallback={
									<>
										<CommandGroup heading={group}>{refs()}</CommandGroup>
										<Show when={index() < filteredItems().length - 1}>
											<CommandSeparator />
										</Show>
									</>
								}
								when={group === 'Default'}
							>
								{refs()}
							</Show>
						);
					}}
				</For>
			</CommandList>
			<div class="p-2 flex items-center gap-2 bg-muted justify-end absolute bottom-0 right-0 rounded-tl-lg">
				<span class="bg-secondary text-secondary-foreground py-1 rounded px-2 text-xs uppercase font-semibold tracking-wider">
					@: Switch Model
				</span>
				<span class="bg-secondary text-secondary-foreground py-1 rounded px-2 text-xs uppercase font-semibold tracking-wider">
					#: Goto Chat
				</span>
				<span class="bg-secondary text-secondary-foreground py-1 rounded px-2 text-xs uppercase font-semibold tracking-wider">
					:: Switch Preset
				</span>
			</div>
		</CommandDialog>
	);
}

export { commandPromptOpen, setCommandPromptOpen };
export default TheCommandPrompt;
