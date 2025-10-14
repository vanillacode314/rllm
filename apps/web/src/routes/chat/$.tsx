import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createShortcut } from '@solid-primitives/keyboard';
import { createElementSize } from '@solid-primitives/resize-observer';
import { makePersisted } from '@solid-primitives/storage';
import { debounce } from '@tanstack/solid-pacer';
import { useMutation, useQuery } from '@tanstack/solid-query';
import { createFileRoute, redirect, useBlocker } from '@tanstack/solid-router';
import { type } from 'arktype';
import localforage from 'localforage';
import { animate } from 'motion';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import {
	batch,
	createMemo,
	createRenderEffect,
	createSignal,
	onMount,
	Show,
	untrack
} from 'solid-js';
import { createStore, modifyMutable, produce, reconcile, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import type { $ResultFetcher } from '~/lib/adapters/types';
import type { TProvider } from '~/types';
import type { TAttachment, TChat, TMessage, TUserMessageChunk } from '~/types/chat';

import Chat from '~/components/Chat';
import TheChatSettingsDrawer from '~/components/TheChatSettingsDrawer';
import ThePromptBox from '~/components/ThePromptBox';
import { onAttachment, onMessage, onRemoveAttachment } from '~/components/ThePromptBox';
import { SidebarTrigger, useSidebar } from '~/components/ui/sidebar';
import { ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT } from '~/constants/prompts';
import { useNotifications } from '~/context/notifications';
import { logger } from '~/db/client';
import { openAiAdapter } from '~/lib/adapters/openai';
import { generateTitleAndTags } from '~/lib/adapters/utils';
import { epubRAGAdapter } from '~/lib/rag/epub';
import { pdfRAGAdapter } from '~/lib/rag/pdf';
import { fetchers, queries } from '~/queries';
import { isMobile } from '~/signals';
import { getMessagesForPath } from '~/utils/chat';
import { formatError } from '~/utils/errors';
import { compressImageFile } from '~/utils/files';
import { fileToBase64 } from '~/utils/files';
import { queryClient } from '~/utils/query-client';
import { slugify } from '~/utils/string';
import { ReactiveTree, ReactiveTreeNode, type TTree } from '~/utils/tree';
import { ragWorkerPool } from '~/workers/rag';

console.error('FIX OPTIMIZE STORAGE');

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

		let [selectedProvider, providers] = await Promise.all([
			queryClient
				.ensureQueryData(queries.userMetadata.byId('selected-provider-id'))
				.then((id) => queryClient.ensureQueryData(queries.providers.byId(id))),
			queryClient.ensureQueryData(queries.providers.all()),
			queryClient.ensureQueryData(queries.userMetadata.byId('selected-model-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name')),
			queryClient
				.ensureQueryData(queries.userMetadata.byId('cors-proxy-url'))
				.then((proxyUrl) => queryClient.ensureQueryData(queries.mcps.all()._ctx.clients(proxyUrl))),
			queryClient.ensureQueryData(queries.chats.all()._ctx.tags)
		]);

		if (!selectedProvider) {
			await logger.dispatch(
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

			selectedProvider = providers[0];
			queryClient.setQueryData(
				queries.providers.byId(selectedProvider.id).queryKey,
				selectedProvider
			);
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
			Object.assign(chat.settings, {
				providerId: newProvider.id,
				model: newProvider.defaultModelIds[0]
			});
			await logger.dispatch({
				user_intent: 'update_chat',
				meta: { id: chat.id, settings: chat.settings }
			});
		}

		return { chat, isNewChat };
	}
});

const [attachments, setAttachments] = makePersisted(createStore<TAttachment[]>([]), {
	name: 'rllm:attachments',
	storage: localforage
});
const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
	name: 'rllm:prompt',
	storage: localforage
});
function ChatPageComponent() {
	const search = Route.useSearch();
	const chatQuery = useQuery(() => ({
		enabled: !!search().id,
		...queries.chats.byId(search().id!)
	}));
	createRenderEffect(() => {
		if (chatQuery.isSuccess && chatQuery.data === null) {
			navigate({ to: '/chat/$', params: { _splat: 'new' } });
		}
	});
	const sidebar = useSidebar();
	useBlocker({
		shouldBlockFn: () => false,
		enableBeforeUnload: () => sendPrompt.isPending
	});

	let promptBoxRef!: HTMLDivElement;
	const promptBoxSize = createElementSize(() => promptBoxRef);
	const loaderData = Route.useLoaderData();
	const searchParams = Route.useSearch();
	const selectedProviderId = useQuery(() => queries.userMetadata.byId('selected-provider-id'));
	const selectedModelId = useQuery(() => queries.userMetadata.byId('selected-model-id'));
	const [promptBoxOffset, setPromptBoxOffset] = createSignal(0);

	const chat = createMemo<TChat>(() => {
		const serverChat = loaderData().chat;
		if (serverChat === null) {
			return {
				id: nanoid(),
				title: 'Untitled New Chat',
				finished: true,
				tags: [],
				settings: {
					providerId: untrack(() => selectedProviderId.data!),
					model: untrack(() => selectedModelId.data!),
					systemPrompt: ''
				},
				messages: new ReactiveTree<TMessage>()
			};
		}
		return {
			...serverChat,
			messages: ReactiveTree.fromJSON<TMessage>(unwrap(serverChat.messages))
		};
	});
	const [, { updateNotification, createNotification, removeNotification }] = useNotifications();

	const navigate = Route.useNavigate();

	const [scrollingStatus, setScrollingStatus] = createSignal<'auto' | 'manual' | 'none'>('none');
	const selectedProvider = useQuery(() =>
		queries.providers.byId(selectedProviderId.isSuccess ? selectedProviderId.data : undefined)
	);
	const [currentPath, setCurrentPath] = createSignal<number[]>(getLatestPath(chat().messages));

	const currentNode = createMemo(() => chat().messages.traverse(currentPath()).unwrap());

	const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
	const proxifyUrl = (url: string) =>
		proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url;

	const fetcher = createMemo(() => {
		const token = selectedProvider.isSuccess ? selectedProvider.data.token : undefined;
		const url = selectedProvider.isSuccess ? proxifyUrl(selectedProvider.data!.baseUrl) : undefined;
		return openAiAdapter.makeFetcher(url, token);
	});

	const tags = useQuery(() => queries.chats.all()._ctx.tags);

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

	let controller = new AbortController();
	const sendPrompt = useMutation(() => ({
		async onMutate({ model, provider, path, chat }) {
			const notificationId = createNotification('Generating Response');
			await batch(async () => {
				await logger.dispatch({
					user_intent: 'update_chat',
					meta: {
						id: chat.id,
						finished: false,
						messages: chat.messages.toJSON()
					},
					dontLog: true
				});
				setScrollingStatus('auto');
				const node = chat.messages.traverse(path).expect('should be able to traverse to node');
				node.addChild(
					new ReactiveTreeNode({
						type: 'llm',
						model: model,
						provider: provider.name,
						chunks: [],
						finished: false
					})
				);
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
			fetcher: $ResultFetcher;
			model: string;
			path: number[];
			provider: TProvider;
		}) => {
			controller.abort();
			controller = new AbortController();

			const node = chat.messages.traverse(path).expect('should be able to traverse to node');
			const message = node.children.at(-1)!.value.expect('should exists since we just created it');
			const messages = getMessagesForPath(
				[...path, node.children.length - 1],
				chat.messages
			).unwrap();

			let tools = await Option.from(mcpClients.data)
				.map((clients) =>
					Promise.all(
						clients
							.values()
							.filter((client) => client.status === 'connected')
							.map((client) => client.listTools())
					).then((value) => value.flat())
				)
				.transposePromise();

			if (attachments.length > 0) {
				const tool = {
					name: 'retrieve_from_attachments',
					schema: type({
						query: type('string'),
						postSearchFilters: {
							limit: type('number.integer > 0'),
							offset: type('number.integer >= 0')
						},
						preSearchFilters: {
							'afterIndex?': type('number.integer >= 0'),
							'beforeIndex?': type('number.integer >= 0')
						}
					}),
					description: ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT(
						attachments.map((attachement) => attachement.description)
					),
					handler: async (args: {
						postSearchFilters: {
							limit: number;
							offset: number;
						};
						preSearchFilters: {
							afterIndex?: number;
							beforeIndex?: number;
						};
						query: string;
					}) => {
						const { query } = args;
						const { limit, offset } = args.postSearchFilters;
						const { afterIndex, beforeIndex } = args.preSearchFilters;
						if (afterIndex !== undefined && beforeIndex !== undefined && afterIndex > beforeIndex) {
							throw new Error('afterIndex must be less than beforeIndex');
						}
						const worker = await ragWorkerPool.get();
						const embedding = await worker.getEmbedding(query);
						const documents = await Promise.all(
							attachments
								.values()
								.flatMap((attachment) =>
									attachment.documents.map((document) => ({
										...document,
										attachment
									}))
								)
								.filter((document) => {
									if (afterIndex !== undefined && document.index < afterIndex) return false;
									if (beforeIndex !== undefined && document.index > beforeIndex) return false;
									return true;
								})
								.map(async (document) => ({
									...document,
									similarity: await worker.cosineSimilarity(embedding, unwrap(document.embeddings))
								}))
						);
						documents.sort((a, b) => b.similarity - a.similarity);

						return JSON.stringify(
							documents.slice(offset, offset + limit).map((document) => ({
								index: document.index,
								description: document.attachment.description,
								content: document.content
							})),
							null,
							2
						);
					}
				};
				tools = Option.Some(
					tools.mapOr([tool], (tools) => {
						tools.push(tool);
						return tools;
					})
				);
			}
			await openAiAdapter
				.handleChatCompletion({
					messages,
					fetcher,
					model,
					tools,
					onChunk: Option.Some(
						debounce(
							async (chunks) => {
								if (chunks.length === 0) return;
								modifyMutable(message.chunks, reconcile(chunks));
							},
							{ wait: 5 }
						)
					),
					onAbort: Option.Some(() => finalizeChat()),
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
			await logger.dispatch({
				user_intent: 'update_chat',
				meta: {
					id: chat.id,
					finished: true,
					messages: chat.messages.toJSON()
				}
			});
			removeNotification(context.notificationId);
		},
		async onSuccess(_, { model, provider, chat }, context) {
			finalizeChat();

			const updates: { model?: string; providerId?: string; tags?: string[]; title?: string } = {};
			if (chat.settings.model !== model) {
				updates.model = model;
			}
			if (chat.settings.providerId !== provider.id) {
				updates.providerId = provider.id;
			}

			if (chat.title === 'Untitled New Chat' && !controller.signal.aborted) {
				const chunks = getMessagesForPath(currentPath(), chat.messages).expect(
					'should be able to get chunks for path'
				);

				updateNotification(context.notificationId, 'Generating Title and Tags');
				let toastId: null | number | string = null;
				if (isMobile()) toastId = toast.loading('Generating Title');

				({ title: updates.title, tags: updates.tags } = await generateTitleAndTags({
					adapter: openAiAdapter,
					fetcher: fetcher(),
					model: selectedModelId.data!,
					providerId: selectedProviderId.data!,
					chunks,
					signal: controller.signal,
					tags: tags.data!
				})
					.inspectErr((e) => console.log(e))
					.unwrapOr({ title: 'Untitled Chat', tags: [] }));

				removeNotification(context.notificationId);
				if (toastId !== null) {
					toast.dismiss(toastId);
				}
			}

			const meta: Partial<Omit<TChat, 'id' | 'messages'>> & { id: string; messages: object } = {
				id: chat.id,
				messages: chat.messages.toJSON()
			};
			if (updates.title) meta.title = updates.title;
			if (updates.tags) meta.tags = updates.tags;
			if (updates.model) {
				meta.settings = chat.settings;
				meta.settings.model = updates.model;
			}
			if (updates.providerId) {
				meta.settings = chat.settings;
				meta.settings.providerId = updates.providerId;
			}
			await logger.dispatch({
				user_intent: 'update_chat',
				meta
			});
		}
	}));

	const handlePrompt = async (prompt: string) => {
		if (sendPrompt.isPending) {
			toast.error('Please wait for the current request to finish');
			return;
		}
		const isPromptEmpty = prompt.trim().length === 0;
		const currentMessage = currentNode().value;
		const currentMessageIsUserMessage = currentMessage.isSomeAnd(
			(message) => message.type === 'user'
		);
		const shouldAddPrompt = currentMessage.isNoneOr(
			(message) => message.type !== 'user' || message.chunks.at(-1)?.type !== 'text'
		);
		if (isPromptEmpty && shouldAddPrompt) {
			toast.error('Prompt is empty');
			return;
		}

		if (shouldAddPrompt) {
			await batch(async () => {
				setPrompt('');
				const chunkId = nanoid();
				const message =
					currentMessageIsUserMessage ? currentMessage : (
						Option.from(currentNode().children[0]).andThen((node) => node.value)
					);

				const newChunks = [
					{
						id: chunkId,
						content: prompt,
						type: 'text'
					}
				] as const;
				if (message.isSomeAnd((message) => message.type === 'user')) {
					message.unwrap().chunks.push(...newChunks);
				} else {
					currentNode().addChild(
						new ReactiveTreeNode({
							type: 'user',
							chunks: newChunks
						} as never)
					);
					setCurrentPath((path) => [...path, 0]);
				}
			});
		}

		const $chat = chat();
		if (loaderData().isNewChat) {
			await logger.dispatch({
				user_intent: 'create_chat',
				meta: {
					...$chat,
					messages: $chat.messages.toJSON()
				}
			});

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
			fetcher: fetcher(),
			model: selectedModelId.data!,
			provider: selectedProvider.data!
		});
	};
	onMessage(handlePrompt);

	async function onEdit(path: number[], chunkIndex: number, chunk: TUserMessageChunk) {
		const node = chat().messages.traverse(path).expect('should be able to traverse to node');
		const parentNode = node.parent.expect('should have a parent node');
		if (node.value.isSomeAnd((message) => message.type !== 'user')) {
			throw new Error('can only edit user messages');
		}
		const chunks = node.value.expect('should have a value').chunks as TUserMessageChunk[];
		const chunkId = nanoid();
		const newChunks = create(chunks, (chunks) => {
			chunks.splice(chunkIndex, 1, { ...chunk, id: chunkId });
		});
		parentNode.addChild(
			new ReactiveTreeNode<TMessage>({
				type: 'user',
				chunks: newChunks
			})
		);
		setCurrentPath(path.slice(0, -1).concat(parentNode.children.length - 1));
		sendPrompt.mutate({
			path: currentPath(),
			chat: chat(),
			fetcher: fetcher(),
			model: selectedModelId.data!,
			provider: selectedProvider.data!
		});
	}

	function onRegenerate(path: number[]) {
		setCurrentPath(path.slice(0, -1));
		sendPrompt.mutate({
			path: currentPath(),
			chat: chat(),
			fetcher: fetcher(),
			model: selectedModelId.data!,
			provider: selectedProvider.data!
		});
	}

	async function onTraversal(path: number[], direction: -1 | 1) {
		const rootPath = path.slice(0, -1).concat(path.at(-1)! + direction);
		const messages = chat().messages.traverse(rootPath).unwrap();
		const newPath = rootPath.concat(getLatestPath(messages));
		setCurrentPath(newPath);
	}

	async function onDelete(path: number[], chunkIndex?: number) {
		outer: if (chunkIndex !== undefined) {
			const message = chat()
				.messages.traverse(path)
				.andThen((node) => node.value)
				.expect('should be able to traverse to node and node should have value');
			if (message.chunks.length === 1) break outer;
			if (message.type !== 'user') throw new Error('can only edit user messages');
			message.chunks.splice(chunkIndex, 1);
			return;
		}
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
		await logger.dispatch({
			user_intent: 'update_chat',
			meta: {
				id: chat().id,
				messages: chat().messages.toJSON()
			}
		});
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
		const $send = searchParams().send;
		if (!$send) {
			await Promise.all([
				Promise.resolve(!$chat.finished).then(async (shouldUpdateFinished) => {
					if (!shouldUpdateFinished) return;
					await logger.dispatch({
						user_intent: 'update_chat',
						meta: {
							id: chat().id,
							finished: true,
							messages: $chat.messages.toJSON()
						}
					});
				}),
				Promise.resolve(selectedProvider.data!.id !== $chat.settings.providerId).then(
					async (shouldUpdateProvider) => {
						if (!shouldUpdateProvider) return;
						await logger.dispatch({
							user_intent: 'set_user_metadata',
							meta: {
								id: 'selected-provider-id',
								value: $chat.settings.providerId
							}
						});
					}
				),
				Promise.resolve(selectedModelId.data! !== $chat.settings.model).then(
					async (shouldUpdateModel) => {
						if (!shouldUpdateModel) return;
						await logger.dispatch({
							user_intent: 'set_user_metadata',
							meta: {
								id: 'selected-model-id',
								value: $chat.settings.model
							}
						});
					}
				)
			]);
			return;
		}

		handlePrompt('');
		await navigate({ search: { id: searchParams().id }, replace: true });
	});

	onAttachment(async (file) => {
		if (file.type.startsWith('image/')) {
			const compressedFile = await compressImageFile(file, {
				quality: 0.8,
				maxHeight: 700,
				maxWidth: 700,
				retainExif: false
			}).unwrap();
			const chunkId = nanoid();
			const currentMessage = currentNode().value;
			const currentMessageIsUserMessage = currentMessage.isSomeAnd(
				(message) => message.type === 'user'
			);
			const message =
				currentMessageIsUserMessage ? currentMessage : (
					Option.from(currentNode().children[0]).andThen((node) => node.value)
				);
			const url = await fileToBase64(compressedFile as File);
			if (message.isSomeAnd((message) => message.type === 'user')) {
				message.unwrap().chunks.push({
					id: chunkId,
					url,
					mimeType: file.type,
					filename: file.name,
					type: 'image_url'
				});
			} else {
				currentNode().addChild(
					new ReactiveTreeNode({
						type: 'user',
						chunks: [
							{
								id: chunkId,
								url,
								mimeType: file.type,
								filename: file.name,
								type: 'image_url'
							}
						]
					})
				);
				setCurrentPath((path) => [...path, 0]);
			}
		} else if (file.type === 'application/pdf' || file.type === 'application/epub+zip') {
			const id = nanoid();
			const attachment = { id, description: file.name, documents: [], progress: 0 };
			const adapter = file.type === 'application/epub+zip' ? epubRAGAdapter : pdfRAGAdapter;
			const idx = attachments.length;
			setAttachments(produce((attachments) => attachments.push(attachment)));
			await tryBlock(
				async function* () {
					const description = yield* adapter.getDescription(file);
					const documents = yield* adapter.getDocuments(file, {
						onProgress(progress) {
							setAttachments(
								produce((attachments) => {
									attachments[idx].progress = progress;
								})
							);
						}
					});
					setAttachments(
						produce((attachments) => {
							attachments[idx].description = description;
							attachments[idx].documents = documents;
						})
					);
				},
				(e) => e
			)
				.inspectErr(() => {
					setAttachments((attachments) => attachments.filter((a) => a.id !== id));
					toast.error('Failed to load document');
				})
				.unwrap();
		} else {
			toast.error('Unsupported file type');
		}
	});
	onRemoveAttachment((id) => {
		setAttachments((attachments) => attachments.filter((attachment) => attachment.id !== id));
	});

	return (
		<div class="content-grid mx-auto w-full" style={{ '--padding-inline': '0rem' }}>
			<Show when={!sidebar.open()}>
				<SidebarTrigger class="absolute z-10 bg-muted/50 backdrop-blur-xl m-4 top-0 left-0 max-md:hidden" />
			</Show>
			<main
				class="h-full grid mx-auto grid-rows-[auto_1fr] w-full overflow-hidden relative isolate"
				style={
					isMobile() ?
						{
							'--translate-y-arrow': `${
								promptBoxOffset() > (promptBoxSize?.width ?? 0) * 0.6 ?
									promptBoxOffset() * ((promptBoxSize?.height ?? 0) / (promptBoxSize?.width ?? 1))
								:	0
							}px`,
							'--translate-x-prompt-box': `${promptBoxOffset()}px`,
							'--bottom-arrow': `calc(${promptBoxSize.height ?? 0}px + var(--spacing) * 8)`
						}
					:	{
							'--bottom-arrow': `calc(${promptBoxSize.height ?? 0}px + var(--spacing) * 8)`
						}
				}
			>
				<Chat
					chat={chat()}
					class="p-4 [view-transition-name:main-content]"
					onDelete={onDelete}
					onEdit={onEdit}
					onRegenerate={onRegenerate}
					onTraversal={onTraversal}
					path={currentPath()}
					ref={(el) => {
						let touchId = 0;
						let start = 0;
						let my = 0;
						const update = () => {
							if (Math.abs(my) < 30) return;
							const target = my < 0 ? promptBoxRef.offsetWidth : 0;
							animate(promptBoxOffset(), target, {
								onUpdate: (offset) => setPromptBoxOffset(offset),
								type: 'spring',
								stiffness: 300,
								damping: 25
							});
						};
						createEventListenerMap(
							() => el,
							{
								touchstart: (event) => {
									if (el.scrollHeight - el.clientHeight <= 30) return;
									touchId = event.touches[0].identifier;
									start = event.touches[0].clientY;
								},
								touchend: (event) => {
									if (el.scrollHeight - el.clientHeight <= 30) return;
									for (const touch of event.changedTouches) {
										if (touch.identifier === touchId) {
											my = touch.clientY - start;
											break;
										}
									}
									if (
										el.scrollTop <= 30 ||
										el.scrollHeight - (el.scrollTop + el.clientHeight) <= 30
									)
										return;
									update();
								}
							},
							{ passive: true }
						);
					}}
					scrollingStatus={scrollingStatus()}
					setScrollingStatus={setScrollingStatus}
					style={{
						'padding-bottom': `calc(${promptBoxSize.height ?? 0}px + var(--spacing) * 6)`
					}}
				/>
				<button
					class="absolute bottom-0 right-0 bg-transparent h-35 w-10 z-10"
					inert={promptBoxOffset() < (promptBoxSize.width ?? 0) * 0.9 || !isMobile()}
					onClick={() => {
						animate(promptBoxOffset(), 0, {
							onUpdate: (offset) => setPromptBoxOffset(offset),
							type: 'spring',
							stiffness: 300,
							damping: 20
						});
					}}
				>
					<span class="sr-only">Show Prompt Box</span>
				</button>
				<ThePromptBox
					attachments={attachments}
					chatId={loaderData().chat?.id}
					class="absolute bottom-0 inset-x-0 will-change-transform bg-card/25 backdrop-blur-xl rounded-lg m-4 border border-input"
					isPending={sendPrompt.isPending}
					onAbort={() => controller.abort()}
					onInput={setPrompt}
					prompt={prompt()}
					ref={promptBoxRef}
					style={{
						transform: `translate3d(var(--translate-x-prompt-box, 0), 0, 0)`
					}}
				/>
			</main>
			<TheChatSettingsDrawer />
		</div>
	);
}

function getLatestPath(messages: TTree<TMessage>, path: number[] = []): number[] {
	if (messages.children.length === 0) return path;
	path.push(messages.children.length - 1);
	return getLatestPath(messages.children[messages.children.length - 1], path);
}
