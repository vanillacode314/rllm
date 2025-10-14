import type { $Fetch } from 'ofetch';

import { createShortcut } from '@solid-primitives/keyboard';
import { makePersisted } from '@solid-primitives/storage';
import { debounce } from '@tanstack/solid-pacer';
import { useMutation, useQuery } from '@tanstack/solid-query';
import { createFileRoute, redirect } from '@tanstack/solid-router';
import { type } from 'arktype';
import { nanoid } from 'nanoid';
import { batch, createMemo, createSignal, onMount, Show } from 'solid-js';
import { createMutable, modifyMutable, reconcile } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';

import type { TProvider } from '~/types';
import type { TChat, TMessage } from '~/types/chat';

import Chat from '~/components/Chat';
import { ModelSelector } from '~/components/ModelSelector';
import PromptBox from '~/components/PromptBox';
import { ProviderSelector } from '~/components/ProviderSelector';
import { Button } from '~/components/ui/button';
import { SidebarTrigger } from '~/components/ui/sidebar';
import { useNotifications } from '~/context/notifications';
import { fetchers, queries } from '~/queries';
import { isMobile } from '~/signals';
import { openAiAdapter } from '~/utils/adapters/openai';
import { generateTitle } from '~/utils/adapters/utils';
import { getChunksForPath } from '~/utils/chat';
import { formatError } from '~/utils/errors';
import { createMessages } from '~/utils/messages';
import { queryClient } from '~/utils/query-client';
import { slugify } from '~/utils/string';
import { cn } from '~/utils/tailwind';
import { ReactiveTree, ReactiveTreeNode } from '~/utils/tree';
import { makeNewMarkdownWorker } from '~/workers/markdown';

import { getLatestPath } from './-utils';

export const Route = createFileRoute('/chat/$')({
	component: ChatPageComponent,
	validateSearch: type({
		'id?': 'string',
		'send?': 'boolean'
	}),
	loaderDeps: ({ search: { id } }) => ({ id }),
	loader: async ({ deps, params }) => {
		const id = deps.id;
		const isNewChat = id === undefined;
		if (id === undefined && params._splat !== 'new')
			throw redirect({ to: '/chat/$', params: { _splat: 'new' } });

		const n = await fetchers.providers.countProviders();
		if (n === 0) throw redirect({ to: '/settings/providers' });

		let [selectedProvider, providers, selectedModelId] = await Promise.all([
			queryClient
				.ensureQueryData(queries.providers.selected())
				.then((id) => queryClient.ensureQueryData(queries.providers.byId(id))),
			queryClient.ensureQueryData(queries.providers.all()),
			queryClient.ensureQueryData(queries.models.selected()),
			queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name')),
			queryClient
				.ensureQueryData(queries.userMetadata.byId('cors-proxy-url'))
				.then((proxyUrl) => queryClient.ensureQueryData(queries.mcps.all()._ctx.clients(proxyUrl)))
		]);

		if (!selectedProvider) {
			await createMessages(
				{
					user_intent: 'set_user_metadata',
					meta: {
						id: 'selected-provider-id',
						value: providers[0].id
					}
				},
				{
					user_intent: 'set_user_metadata',
					meta: {
						id: 'selected-model-id',
						value: providers[0].defaultModelIds[0]
					}
				}
			);

			[selectedProvider, selectedModelId] = await Promise.all([
				queryClient.fetchQuery({ ...queries.providers.byId(providers[0].id), staleTime: 0 }),
				queryClient.fetchQuery({ ...queries.providers.selected(), staleTime: 0 }),
				queryClient.fetchQuery({ ...queries.models.selected(), staleTime: 0 }),
				queryClient.fetchQuery({
					...queries.userMetadata.byId('selected-provider-id'),
					staleTime: 0
				})
			]);
		}

		if (isNewChat) {
			return { chat: null, isNewChat };
		}

		const chat = await queryClient.fetchQuery(queries.chats.byId(id));
		if (chat === null) throw redirect({ to: '/chat/$', params: { _splat: 'new' } });
		const provider = await queryClient.ensureQueryData(
			queries.providers.byId(chat.settings.providerId)
		);

		if (provider === null) {
			const newProvider = providers[0];
			await createMessages({
				user_intent: 'update_chat',
				meta: Object.assign(chat, {
					settings: Object.assign(chat.settings, {
						providerId: newProvider.id,
						model: newProvider.defaultModelIds[0]
					})
				})
			});
		}

		const tree = ReactiveTree.fromJSON<TMessage>(chat.messages);
		const path = getLatestPath(tree);
		await Promise.all(
			tree
				.iter(path)
				.flatMap(({ node }) =>
					node
						.map((node) => node.value)
						.flatten()
						.map((node) => node.chunks)
						.unwrap()
						.flat()
				)
				.filter((chunk) => chunk.type === 'text')
				.map(async (chunk) => {
					const markdownWorker = makeNewMarkdownWorker();
					const html = await markdownWorker.render(chunk.content);
					queryClient.setQueryData(['html', chunk.id], html);
				})
		);

		return { chat, isNewChat };
	}
});

function ChatPageComponent() {
	const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
		name: 'rllm:prompt'
	});

	const loaderData = Route.useLoaderData();
	const searchParams = Route.useSearch();
	const selectedProviderId = useQuery(() => queries.providers.selected());
	const selectedModelId = useQuery(() => queries.models.selected());

	const chat = createMemo<TChat>(() => {
		const serverChat = loaderData().chat;
		if (serverChat === null) {
			return {
				id: nanoid(),
				title: 'Untitled New Chat',
				finished: true,
				settings: {
					providerId: selectedProviderId.data!,
					model: selectedModelId.data!,
					systemPrompt: ''
				},
				messages: new ReactiveTree<TMessage>()
			};
		}
		return {
			...serverChat,
			messages: ReactiveTree.fromJSON<TMessage>(serverChat.messages)
		};
	});
	const [, { createNotification, removeNotification }] = useNotifications();

	const navigate = Route.useNavigate();

	const [manualScrolling, setManualScrolling] = createSignal<boolean>(false);
	const providers = useQuery(() => queries.providers.all());
	const selectedProvider = useQuery(() =>
		queries.providers.byId(selectedProviderId.isSuccess ? selectedProviderId.data : undefined)
	);
	const [currentPath, setCurrentPath] = createSignal<number[]>(getLatestPath(chat().messages));

	const currentNode = createMemo(() => chat().messages.traverse(currentPath()).unwrap());

	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const proxifyUrl = (url: string) =>
		proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url;
	const baseUrl = createMemo(() =>
		Option.fromUndefinedOrNull(selectedProvider.isSuccess ? selectedProvider.data : null).map(
			(data) => proxifyUrl(data.baseUrl)
		)
	);

	const fetcher = useQuery(() => ({
		enabled: selectedProvider.isSuccess,
		queryKey: [
			'fetcher',
			{
				token: selectedProvider.isSuccess ? selectedProvider.data.token : null,
				url: baseUrl()
			}
		] as const,
		queryFn: ({ queryKey: [, { token, url }] }) =>
			openAiAdapter.makeFetcher(url, Option.fromNull(token))
	}));

	const mcpClients = useQuery(() => queries.mcps.all()._ctx.clients(proxyUrl.data));

	function finalizeChat(error?: string) {
		const node = currentNode();
		if (node.value.isNoneOr((value) => value.type !== 'llm')) {
			console.error('currentNode is not an llm message');
			return;
		}

		const message = node.value.unwrap() as TMessage & { type: 'llm' };
		message.finished = true;
		const chunk = message.chunks.at(-1);
		if (chunk && 'finished' in chunk) chunk.finished = true;
		if (error) {
			message.error = error;
		}
	}

	const invalidateChunk = (id: string) => {
		queryClient.cancelQueries({
			queryKey: ['html', id]
		});
		queryClient.invalidateQueries({
			queryKey: ['html', id]
		});
	};

	let controller = new AbortController();
	const sendPrompt = useMutation(() => ({
		async onMutate({ model, provider, path, chat }) {
			const notificationId = createNotification('Generating Response');
			await batch(async () => {
				await createMessages({
					user_intent: 'update_chat',
					meta: {
						...Object.assign(chat, {
							finished: false
						}),
						messages: chat.messages.toJSON()
					}
				});
				queryClient.invalidateQueries(queries.chats.all());
				queryClient.invalidateQueries(queries.chats.byId(chat.id));
				setManualScrolling(false);
				const node = chat.messages.traverse(path).expect('should be able to traverse to node');
				const message = createMutable({
					type: 'llm',
					model: model,
					provider: provider.name,
					chunks: [],
					finished: false
				} as TMessage);
				node.addChild(new ReactiveTreeNode(message));
				const newPath = [...path, node.children.length - 1];
				setCurrentPath(newPath);
			});
			return { notificationId };
		},
		mutationFn: async ({
			fetcher,
			model,
			path,
			chat
		}: {
			chat: TChat;
			fetcher: $Fetch;
			model: string;
			path: number[];
			provider: TProvider;
		}) => {
			controller.abort();
			controller = new AbortController();

			const node = chat.messages.traverse(path).expect('should be able to traverse to node');
			const message = node.children.at(-1)!.value.expect('should exists since we just created it');
			const chunks = getChunksForPath(path, chat.messages).unwrap();

			const tools = await Option.fromUndefinedOrNull(mcpClients.data)
				.map((clients) =>
					Promise.all(
						clients
							.values()
							.filter((client) => client.status === 'connected')
							.map((client) => client.listTools())
					).then((value) => value.flat())
				)
				.transposePromise();

			let debouncedInvalidateChunk = () => {};
			let currentChunkId: null | string = null;
			await openAiAdapter
				.handleChatCompletion({
					chunks,
					fetcher,
					model,
					tools,
					onChunk: Option.Some(async (chunks) => {
						if (chunks.length === 0) return;
						modifyMutable(message.chunks, reconcile(chunks));
						const chunkId = chunks.at(-1)!.id;
						if (currentChunkId !== chunkId) {
							currentChunkId = chunkId;
							debouncedInvalidateChunk = debounce(() => invalidateChunk(chunkId), { wait: 16 });
						}
						debouncedInvalidateChunk();
					}),
					onAbort: Option.Some(finalizeChat),
					signal: Option.Some(controller.signal)
				})
				.match(
					() => {},
					(error) => {
						if (controller.signal.aborted) return;
						throw error;
					}
				);
		},
		onError(error) {
			console.debug(error);
			finalizeChat(formatError(error));
		},
		async onSettled(_, __, { chat }, context) {
			if (!context) return;
			await createMessages({
				user_intent: 'update_chat',
				meta: {
					...Object.assign(chat, {
						finished: true
					}),
					messages: chat.messages.toJSON()
				}
			});
			queryClient.invalidateQueries(queries.chats.all());
			queryClient.invalidateQueries(queries.chats.byId(chat.id));
			removeNotification(context.notificationId);
		},
		async onSuccess(_, { model, provider, chat }) {
			finalizeChat();

			if (chat.settings.model !== model) {
				chat.settings.model = model;
			}
			if (chat.settings.providerId !== provider.id) {
				chat.settings.providerId = provider.id;
			}

			if (chat.title === 'Untitled New Chat') {
				const chunks = getChunksForPath(currentPath(), chat.messages).expect(
					'should be able to get chunks for path'
				);

				const notificationId = createNotification('Generating Title');
				let toastId: null | number | string = null;
				if (isMobile()) toastId = toast.loading('Generating Title');

				chat.title = await generateTitle(
					openAiAdapter,
					fetcher.data!,
					selectedModelId.data!,
					chunks
				)
					.inspectErr((e) => console.log(e))
					.unwrapOr('Untitled Chat');

				removeNotification(notificationId);
				if (toastId !== null) {
					toast.dismiss(toastId);
				}
			}

			await createMessages({
				user_intent: 'update_chat',
				meta: { ...chat, messages: chat.messages.toJSON() }
			});
		}
	}));

	async function onSubmit(inputPrompt: string) {
		if (sendPrompt.isPending) {
			toast.error('Please wait for the current request to finish');
			return;
		}
		const isPromptEmpty = inputPrompt.trim().length === 0;
		const shouldAddPrompt = currentNode().value.isNoneOr((node) => node.type !== 'user');
		if (isPromptEmpty && shouldAddPrompt) {
			toast.error('Prompt is empty');
			return;
		}

		if (shouldAddPrompt) {
			batch(() => {
				setPrompt('');
				currentNode().addChild(
					new ReactiveTreeNode({
						type: 'user',
						chunks: [{ id: nanoid(), content: inputPrompt, type: 'text' }]
					})
				);
				setCurrentPath((path) => [...path, 0]);
			});
		}

		const $chat = chat();
		if (loaderData().isNewChat) {
			await createMessages({
				user_intent: 'create_chat',
				meta: {
					...$chat,
					messages: $chat.messages.toJSON()
				}
			});
			await Promise.all([
				queryClient.invalidateQueries(queries.chats.all()),
				queryClient.invalidateQueries(queries.chats.byId($chat.id))
			]);

			await navigate({
				to: '/chat/$',
				params: { _splat: slugify($chat.title) },
				search: { id: $chat.id, send: true },
				replace: true
			});
			return;
		}

		sendPrompt.mutate({
			path: currentPath(),
			chat: $chat,
			fetcher: fetcher.data!,
			model: selectedModelId.data!,
			provider: selectedProvider.data!
		});
	}

	// TODO: account for chunk index
	function onEdit(path: number[], content: string) {
		const parentNode = path.slice(0, -1).reduce((node, index) => {
			const child = node.children[index];
			if (!child) throw new Error('Invalid path');
			return child;
		}, chat().messages);
		parentNode.addChild(
			new ReactiveTreeNode({
				type: 'user',
				chunks: [{ id: nanoid(), content, type: 'text' }]
			})
		);
		setCurrentPath(path.slice(0, -1).concat(parentNode.children.length - 1));
		sendPrompt.mutate({
			path: currentPath(),
			chat: chat(),
			fetcher: fetcher.data!,
			model: selectedModelId.data!,
			provider: selectedProvider.data!
		});
	}

	function onRegenerate(path: number[]) {
		setCurrentPath(path.slice(0, -1));
		sendPrompt.mutate({
			path: currentPath(),
			chat: chat(),
			fetcher: fetcher.data!,
			model: selectedModelId.data!,
			provider: selectedProvider.data!
		});
	}

	async function onTraversal(path: number[], direction: -1 | 1) {
		const rootPath = path.slice(0, -1).concat(path.at(-1)! + direction);
		const messages = chat().messages.traverse(rootPath).unwrap();
		const newPath = rootPath.concat(getLatestPath(messages));
		await Promise.all(
			chat()
				.messages.iter(newPath)
				.flatMap(({ node }) => {
					const chunks = node.unwrap().value.unwrap().chunks;
					return chunks
						.filter((chunk) => chunk.type === 'text')
						.map(async (chunk) => {
							const markdownWorker = makeNewMarkdownWorker();
							const html = await markdownWorker.render(chunk.content);
							queryClient.setQueryData(['html', chunk.id], html);
						});
				})
		);
		setCurrentPath(newPath);
	}

	async function onDelete(path: number[]) {
		const parentNode = chat().messages.traverse(path.slice(0, -1)).unwrap();
		setCurrentPath(path.slice(0, -1));
		if (parentNode.children.length === 1) {
			parentNode.removeChild(path.at(-1)!);
		} else if (path.at(-1) === parentNode.children.length - 1) {
			parentNode.removeChild(path.at(-1)!);
			onTraversal(path, -1);
		} else {
			parentNode.removeChild(path.at(-1)!);
			setCurrentPath(path.concat(getLatestPath(parentNode.children[path.at(-1)!])));
		}
		await createMessages({
			user_intent: 'update_chat',
			meta: {
				...chat(),
				messages: chat().messages.toJSON()
			}
		});
		await Promise.all([
			queryClient.invalidateQueries(queries.chats.all()),
			queryClient.invalidateQueries(queries.chats.byId(chat().id))
		]);
	}

	createShortcut(
		['Control', 'Enter'],
		(event) => {
			if (!event) return;
			if (document.activeElement?.id === 'prompt') {
				event.preventDefault();
				const form = document.getElementById('message-form') as HTMLFormElement;
				if (!form) throw new Error('form missing');
				form.requestSubmit();
			}
		},
		{ preventDefault: false }
	);

	onMount(async () => {
		const $chat = chat();
		await Promise.all([
			Promise.resolve(!$chat.finished).then(async (shouldUpdateFinished) => {
				if (!shouldUpdateFinished) return;
				await createMessages({
					user_intent: 'update_chat',
					meta: {
						...Object.assign($chat, {
							finished: true
						}),
						messages: $chat.messages.toJSON()
					}
				});
				await queryClient.invalidateQueries(queries.chats.all());
				await queryClient.invalidateQueries(queries.chats.byId($chat.id));
			}),
			Promise.resolve(selectedProvider.data!.id !== $chat.settings.providerId).then(
				async (shouldUpdateProvider) => {
					if (!shouldUpdateProvider) return;
					await createMessages({
						user_intent: 'set_user_metadata',
						meta: {
							id: 'selected-provider-id',
							value: $chat.settings.providerId
						}
					});
					await queryClient.invalidateQueries(queries.providers.selected());
				}
			),
			Promise.resolve(selectedModelId.data! !== $chat.settings.model).then(
				async (shouldUpdateModel) => {
					if (!shouldUpdateModel) return;
					await createMessages({
						user_intent: 'set_user_metadata',
						meta: {
							id: 'selected-model-id',
							value: $chat.settings.model
						}
					});
					await queryClient.invalidateQueries(queries.models.selected());
				}
			)
		]);

		if (searchParams().send) {
			onSubmit('');
			await navigate({ search: { id: searchParams().id }, replace: true });
		}
	});

	return (
		<div class="content-grid mx-auto w-full" style={{ '--padding-inline': '0rem' }}>
			<main class="h-full grid mx-auto grid-rows-[auto_1fr_auto] w-full overflow-hidden">
				<div class="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_250px_250px_auto] gap-2 items-center p-4">
					<SidebarTrigger />
					<ProviderSelector
						class="max-sm:col-span-2"
						onChange={async (provider) => {
							await createMessages(
								{
									user_intent: 'set_user_metadata',
									meta: { id: 'selected-provider-id', value: provider.id }
								},
								{
									user_intent: 'set_user_metadata',
									meta: { id: 'selected-model-id', value: provider.defaultModelIds[0] }
								}
							);
							await Promise.all([
								queryClient.invalidateQueries(queries.userMetadata.byId('selected-provider-id')),
								queryClient.invalidateQueries(queries.userMetadata.byId('selected-model-id')),
								queryClient.invalidateQueries(queries.providers.selected()),
								queryClient.invalidateQueries(queries.models.selected())
							]);
						}}
						providers={providers.isSuccess ? providers.data : []}
						selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
					/>
					<ModelSelector
						class={cn(
							'max-sm:col-span-2',
							loaderData().isNewChat && 'max-sm:col-start-1 max-sm:col-end-4'
						)}
						fetcher={fetcher.data!}
						onChange={async (model) => {
							await createMessages({
								user_intent: 'set_user_metadata',
								meta: { id: 'selected-model-id', value: model.id }
							});
							await Promise.all([
								queryClient.invalidateQueries(queries.userMetadata.byId('selected-model-id')),
								queryClient.invalidateQueries(queries.models.selected())
							]);
						}}
						selectedModelId={selectedModelId.isSuccess ? selectedModelId.data : null}
						selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
					/>
					<Show when={!loaderData().isNewChat}>
						<Button
							onClick={() => navigate({ to: '/chat/$', params: { _splat: 'new' } })}
							size="icon"
							type="button"
							variant="ghost"
						>
							<span class="icon-[heroicons--plus-circle] text-xl" />
							<span class="sr-only">New chat</span>
						</Button>
					</Show>
				</div>
				<Chat
					chat={chat()}
					class="pt-0 p-4"
					manualScrolling={manualScrolling()}
					onDelete={onDelete}
					onEdit={onEdit}
					onRegenerate={onRegenerate}
					onTraversal={onTraversal}
					path={currentPath()}
					setManualScrolling={setManualScrolling}
				/>
				<PromptBox
					chatId={loaderData().chat?.id}
					class="pt-0 p-4"
					isPending={sendPrompt.isPending}
					onAbort={() => controller.abort()}
					onInput={setPrompt}
					onSubmit={onSubmit}
					prompt={prompt()}
				/>
			</main>
		</div>
	);
}
