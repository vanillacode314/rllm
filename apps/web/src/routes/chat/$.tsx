import { createShortcut } from '@solid-primitives/keyboard';
import { createElementSize } from '@solid-primitives/resize-observer';
import { makePersisted } from '@solid-primitives/storage';
import { debounce } from '@tanstack/solid-pacer';
import { useMutation, useQuery } from '@tanstack/solid-query';
import { createFileRoute, redirect, useBlocker } from '@tanstack/solid-router';
import { Gesture } from '@use-gesture/vanilla';
import { type } from 'arktype';
import { animate } from 'motion';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import {
	batch,
	createMemo,
	createRenderEffect,
	createSignal,
	onCleanup,
	onMount,
	Show,
	untrack
} from 'solid-js';
import { createStore, modifyMutable, produce, reconcile, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';

import type { $ResultFetcher } from '~/lib/adapters/types';
import type { TProvider } from '~/types';
import type { TAttachment, TChat, TMessage, TUserMessageChunk } from '~/types/chat';

import Chat from '~/components/Chat';
import { markdownQuery } from '~/components/Markdown';
import PromptBox from '~/components/PromptBox';
import TheChatSettingsDrawer from '~/components/TheChatSettingsDrawer';
import { SidebarTrigger, useSidebar } from '~/components/ui/sidebar';
import { useNotifications } from '~/context/notifications';
import { openAiAdapter } from '~/lib/adapters/openai';
import { generateTitleAndTags } from '~/lib/adapters/utils';
import { epubRAGAdapter } from '~/lib/rag/epub';
import { pdfRAGAdapter } from '~/lib/rag/pdf';
import { createWorkerPool } from '~/utils/workers';
import { fetchers, queries } from '~/queries';
import { isMobile } from '~/signals';
import { getMessagesForPath } from '~/utils/chat';
import { formatError } from '~/utils/errors';
import { compressImageFile } from '~/utils/files';
import { fileToBase64 } from '~/utils/files';
import { createMessages } from '~/utils/messages';
import { queryClient } from '~/utils/query-client';
import { slugify } from '~/utils/string';
import { ReactiveTree, ReactiveTreeNode } from '~/utils/tree';
import localforage from 'localforage';

import { getLatestPath } from './-utils';
import { makeNewRagWorker } from '~/workers/rag';
import { ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT } from '~/constants/prompts';

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
				.ensureQueryData(queries.providers.selected())
				.then((id) => queryClient.ensureQueryData(queries.providers.byId(id))),
			queryClient.ensureQueryData(queries.providers.all()),
			queryClient.ensureQueryData(queries.models.selected()),
			queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name')),
			queryClient
				.ensureQueryData(queries.userMetadata.byId('cors-proxy-url'))
				.then((proxyUrl) => queryClient.ensureQueryData(queries.mcps.all()._ctx.clients(proxyUrl))),
			queryClient.ensureQueryData(queries.chats.all()._ctx.tags)
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
			).unwrap();

			selectedProvider = await queryClient.ensureQueryData(queries.providers.byId(providers[0].id));
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
			}).unwrap();
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
				.map((chunk) => queryClient.fetchQuery(markdownQuery(chunk.id, chunk.content)))
		);

		return { chat, isNewChat };
	}
});

function ChatPageComponent() {
	const [attachments, setAttachments] = makePersisted(createStore<TAttachment[]>([]), {
		name: 'rllm:attachments',
		storage: localforage
	});
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
	const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
		name: 'rllm:prompt',
		storage: localforage
	});

	let promptBoxRef!: HTMLDivElement;
	const promptBoxSize = createElementSize(() => promptBoxRef);
	const loaderData = Route.useLoaderData();
	const searchParams = Route.useSearch();
	const selectedProviderId = useQuery(() => queries.providers.selected());
	const selectedModelId = useQuery(() => queries.models.selected());
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

	const invalidateChunk = async (id: string, content: string) => {
		const query = markdownQuery(id, content);
		await queryClient.cancelQueries(query);
		await queryClient.invalidateQueries(query);
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
					},
					dontLog: true
				}).unwrap();
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
						query: type('string').describe(
							'The search query to find relevant content in attachments'
						),
						limit: type('number.integer > 0').describe('Maximum number of results to return '),
						offset: type('number.integer >= 0').describe(
							'Starting point for results (useful for pagination)'
						)
					}),
					description: ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT(
						attachments.map((attachement) => attachement.description)
					),
					handler: async (args: { limit: number; offset: number; query: string }) => {
						const ragWorkerPool = createWorkerPool(
							makeNewRagWorker,
							navigator.hardwareConcurrency / 2
						);
						const embedding = await ragWorkerPool.runTask((worker) =>
							worker.getEmbedding(args.query)
						);
						const documents = (
							await Promise.all(
								attachments.flatMap((attachement) =>
									attachement.documents.map(async (document) => ({
										...document,
										attachement,
										similarity: await ragWorkerPool.runTask((worker) =>
											worker.cosineSimilarity(embedding, unwrap(document.embeddings))
										)
									}))
								)
							)
						)
							.toSorted((a, b) => b.similarity - a.similarity)
							.slice(args.offset, args.offset + args.limit);
						return documents
							.map(
								(document) =>
									`Context from ${document.attachement.description}:\n${document.content}`
							)
							.join('\n\n');
					}
				};
				tools = Option.Some(
					tools.mapOr([tool], (tools) => {
						tools.push(tool);
						return tools;
					})
				);
			}
			let debouncedInvalidateChunk: (content: string) => void = () => {};
			let currentChunkId: null | string = null;
			await openAiAdapter
				.handleChatCompletion({
					messages,
					fetcher,
					model,
					tools,
					onChunk: Option.Some(async (chunks) => {
						if (chunks.length === 0) return;
						modifyMutable(message.chunks, reconcile(chunks));
						const chunk = chunks.at(-1)!;
						if (currentChunkId !== chunk.id) {
							currentChunkId = chunk.id;
							debouncedInvalidateChunk = debounce(
								(content: string) => invalidateChunk(chunk.id, content),
								{
									wait: 5
								}
							);
						}
						debouncedInvalidateChunk(chunk.content);
					}),
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
			await createMessages({
				user_intent: 'update_chat',
				meta: {
					...Object.assign(chat, {
						finished: true
					}),
					messages: chat.messages.toJSON()
				}
			}).unwrap();
			removeNotification(context.notificationId);
		},
		async onSuccess(_, { model, provider, chat }, context) {
			finalizeChat();

			if (chat.settings.model !== model) {
				chat.settings.model = model;
			}
			if (chat.settings.providerId !== provider.id) {
				chat.settings.providerId = provider.id;
			}

			if (chat.title === 'Untitled New Chat' && !controller.signal.aborted) {
				const chunks = getMessagesForPath(currentPath(), chat.messages).expect(
					'should be able to get chunks for path'
				);

				updateNotification(context.notificationId, 'Generating Title and Tags');
				let toastId: null | number | string = null;
				if (isMobile()) toastId = toast.loading('Generating Title');

				({ title: chat.title, tags: chat.tags } = await generateTitleAndTags({
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

			await createMessages({
				user_intent: 'update_chat',
				meta: { ...chat, messages: chat.messages.toJSON() }
			}).unwrap();
		}
	}));

	async function onSubmit(inputPrompt: string) {
		if (sendPrompt.isPending) {
			toast.error('Please wait for the current request to finish');
			return;
		}
		const isPromptEmpty = inputPrompt.trim().length === 0;
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
						content: inputPrompt,
						type: 'text'
					}
				];
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
				await queryClient.fetchQuery(markdownQuery(chunkId, inputPrompt));
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
			}).unwrap();

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
	}

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
		if (chunk.type === 'text') {
			await queryClient.fetchQuery(markdownQuery(chunkId, chunk.content));
		}
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
		await Promise.all(
			chat()
				.messages.iter(newPath)
				.flatMap(({ node }) => {
					const chunks = node.unwrap().value.unwrap().chunks;
					return chunks
						.filter((chunk) => chunk.type === 'text')
						.map((chunk) => queryClient.fetchQuery(markdownQuery(chunk.id, chunk.content)));
				})
		);
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
		await createMessages({
			user_intent: 'update_chat',
			meta: {
				...chat(),
				messages: chat().messages.toJSON()
			}
		}).unwrap();
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
					await createMessages({
						user_intent: 'update_chat',
						meta: {
							...Object.assign($chat, {
								finished: true
							}),
							messages: $chat.messages.toJSON()
						}
					}).unwrap();
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
						}).unwrap();
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
						}).unwrap();
					}
				)
			]);
			return;
		}

		onSubmit('');
		await navigate({ search: { id: searchParams().id }, replace: true });
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
					class="p-4"
					onDelete={onDelete}
					onEdit={onEdit}
					onRegenerate={onRegenerate}
					onTraversal={onTraversal}
					path={currentPath()}
					ref={(el) => {
						const gesture = new Gesture(
							el,
							{
								// onScroll({ delta: [dx, dy], movement: [mx, my] }) {
								// 	if (my < 0) return;
								// 	if (!isMobile()) return;
								// 	if (scrollingStatus() === 'auto') return;
								// 	setPromptBoxOffset(clamp(0, promptBoxOffset() + dy, promptBoxRef.offsetWidth));
								// },
								onDragEnd({ movement: [_mx, my] }) {
									if (!isMobile()) return;
									if (scrollingStatus() === 'auto') return;
									if (Math.abs(my) < 30) return;
									const target = my < 0 ? promptBoxRef.offsetWidth : 0;
									animate(promptBoxOffset(), target, {
										onUpdate: (offset) => setPromptBoxOffset(offset),
										type: 'spring',
										stiffness: 300,
										damping: 25
									});
								}
							},
							{ eventOptions: { passive: true }, drag: { axis: 'y', pointer: { touch: true } } }
						);
						onCleanup(() => gesture.destroy());
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
				<PromptBox
					attachments={attachments}
					chatId={loaderData().chat?.id}
					class="absolute bottom-0 inset-x-0 will-change-transform bg-card/25 backdrop-blur-xl rounded-lg m-4 border border-input"
					isPending={sendPrompt.isPending}
					onAbort={() => controller.abort()}
					onDocument={async (file) => {
						const adapter = file.type === 'application/epub+zip' ? epubRAGAdapter : pdfRAGAdapter;
						const id = nanoid();
						const attachment = { id, description: file.name, documents: [], progress: 0 };
						const idx = attachments.length;
						setAttachments(produce((attachments) => attachments.push(attachment)));
						const description = await adapter.getDescription(file).unwrap();
						const documents = await adapter
							.getDocuments(file, {
								onProgress(progress) {
									setAttachments(
										produce((attachments) => {
											attachments[idx].progress = progress;
										})
									);
								}
							})
							.unwrap();
						setAttachments(
							produce((attachments) => {
								attachments[idx].description = description;
								attachments[idx].documents = documents;
							})
						);
					}}
					onImage={async (file) => {
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
					}}
					onInput={setPrompt}
					onRemoveAttachment={(id) => {
						setAttachments((attachments) =>
							attachments.filter((attachment) => attachment.id !== id)
						);
					}}
					onSubmit={onSubmit}
					prompt={prompt()}
					ref={promptBoxRef}
					style={{
						transform: `translate3d(var(--translate-x-prompt-box, 0), 0, 0)`
					}}
				/>
				{/* style={{ */}
				{/* 	transform: `translate3d(var(--translate-x-prompt-box, 0), 0, 0)` */}
				{/* }} */}
			</main>
			<TheChatSettingsDrawer />
		</div>
	);
}
