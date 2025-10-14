import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createShortcut } from '@solid-primitives/keyboard';
import { createWritableMemo } from '@solid-primitives/memo';
import { createElementSize } from '@solid-primitives/resize-observer';
import { makePersisted } from '@solid-primitives/storage';
import { useMutation, useQuery } from '@tanstack/solid-query';
import { createFileRoute, redirect, useBlocker, useRouter } from '@tanstack/solid-router';
import localforage from 'localforage';
import { animate } from 'motion';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { Type } from 'typebox';
import Compile from 'typebox/compile';

import type { $ResultFetcher } from '~/lib/adapters/types';
import type { TProvider } from '~/types';
import type { TAttachment, TChat, TMessage, TUserMessageChunk } from '~/types/chat';

import Chat from '~/components/Chat';
import TheChatSettingsDrawer from '~/components/TheChatSettingsDrawer';
import ThePromptBox from '~/components/ThePromptBox';
import { onAttachment, onMessage, onRemoveAttachment } from '~/components/ThePromptBox';
import { SidebarTrigger, useSidebar } from '~/components/ui/sidebar';
import { useNotifications } from '~/context/notifications';
import { logger } from '~/db/client';
import { openAiAdapter } from '~/lib/adapters/openai';
import { generateTitleAndTags } from '~/lib/adapters/utils';
import { ChatGenerationManager } from '~/lib/chat/manager';
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

import { finalizeChat } from './-utils';

console.error('FIX OPTIMIZE STORAGE');

const QuerySchema = Type.Object({
	id: Type.Optional(Type.String())
});
const QueryValidator = Compile(QuerySchema);

export const Route = createFileRoute('/chat/$')({
	component: ChatPageComponent,
	validateSearch: (value) => QueryValidator.Parse(value),
	loaderDeps: ({ search: { id } }) => ({ id: id ?? nanoid(), isNewChat: id === undefined }),
	shouldReload: true,
	gcTime: 0,
	loader: async ({ deps, params }) => {
		async function ensureValidChatProvider(chatId: string, providers: TProvider[]) {
			const chat = await queryClient.fetchQuery(queries.chats.byId(chatId));
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
					type: 'updateChat',
					data: { id: chat.id, settings: chat.settings }
				});
			}
			return chat;
		}

		async function ensureValidSelectedProvider() {
			const n = await fetchers.providers.countProviders();
			if (n === 0) throw redirect({ to: '/settings/providers' });

			let [selectedProvider, providers] = await Promise.all([
				queryClient
					.ensureQueryData(queries.userMetadata.byId('selected-provider-id'))
					.then((id) => (id ? queryClient.ensureQueryData(queries.providers.byId(id)) : null)),
				queryClient.ensureQueryData(queries.providers.all())
			]);

			if (!selectedProvider) {
				await logger.dispatch(
					{
						type: 'setUserMetadata',
						data: {
							id: 'selected-provider-id',
							value: providers[0].id
						}
					},
					{
						type: 'setUserMetadata',
						data: {
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
			return providers;
		}

		const { id, isNewChat } = deps;
		if (isNewChat && params._splat !== 'new')
			throw redirect({ to: '/chat/$', params: { _splat: 'new' } });

		const [providers] = await Promise.all([
			ensureValidSelectedProvider(),
			queryClient.ensureQueryData(queries.userMetadata.byId('selected-model-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name')),
			queryClient
				.ensureQueryData(queries.userMetadata.byId('cors-proxy-url'))
				.then((proxyUrl) => queryClient.ensureQueryData(queries.mcps.all()._ctx.clients(proxyUrl))),
			queryClient.ensureQueryData(queries.chats.all()._ctx.tags)
		]);

		if (isNewChat) return { chat: null, isNewChat, id };

		const chat = await ensureValidChatProvider(id, providers);

		return { chat, isNewChat, id: chat.id };
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
const [chatsToSend, setChatsToSend] = makePersisted(createSignal<string[]>([]), {
	name: 'rllm:chats-to-send',
	storage: localforage
});
function ChatPageComponent() {
	const router = useRouter();
	const searchParams = Route.useSearch();
	const loaderData = Route.useLoaderData();
	const navigate = Route.useNavigate();

	const sidebar = useSidebar();
	useBlocker({
		shouldBlockFn: () => false,
		enableBeforeUnload: () => sendPrompt.isPending
	});

	onMount(() => {
		onCleanup(
			logger.on('deleteChat', async (event) => {
				if (event.id !== searchParams().id) return;
				await navigate({ to: '/chat/$', params: { _splat: 'new' } });
			})
		);
		onCleanup(
			logger.on('updateChat', async (event) => {
				if (event.id !== searchParams().id) return;
				toast.info('Chat updated', {
					action: {
						label: 'Reload',
						onClick: () => router.invalidate()
					},
					duration: Number.POSITIVE_INFINITY
				});
			})
		);
	});

	let promptBoxRef!: HTMLDivElement;
	const promptBoxSize = createElementSize(() => promptBoxRef);
	const selectedProviderId = useQuery(() => queries.userMetadata.byId('selected-provider-id'));
	const selectedModelId = useQuery(() => queries.userMetadata.byId('selected-model-id'));
	const [promptBoxOffset, setPromptBoxOffset] = createSignal(0);

	const [chat, setChat] = createWritableMemo<TChat>(() =>
		loaderData().isNewChat ?
			{
				id: loaderData().id,
				title: 'Untitled New Chat',
				finished: true,
				tags: [],
				settings: {
					providerId: selectedProviderId.data!,
					model: selectedModelId.data!,
					systemPrompt: ''
				},
				messages: new ReactiveTree<TMessage>()
			}
		:	(ChatGenerationManager.getChat(loaderData().id) ?? {
				...loaderData().chat!,
				settings: {
					providerId: selectedProviderId.data!,
					model: selectedModelId.data!,
					systemPrompt: ''
				},
				messages: ReactiveTree.fromJSON<TMessage>(unwrap(loaderData().chat!.messages))
			})
	);
	const [, { updateNotification, createNotification, removeNotification }] = useNotifications();

	const selectedProvider = useQuery(() => queries.providers.byId(selectedProviderId.data));
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

	const sendPrompt = useMutation(() => ({
		onMutate() {
			const notificationId = createNotification('Generating Response');
			return { notificationId };
		},
		mutationFn: async ({
			fetcher,
			path,
			chat
		}: {
			chat: TChat;
			fetcher: $ResultFetcher;
			path: number[];
		}) => {
			const chatContext = await ChatGenerationManager.startGeneration(
				chat.id,
				chat,
				path,
				mcpClients.data ?? [],
				attachments,
				fetcher
			);
			setChat(chatContext.newChat);
			setCurrentPath(chatContext.newPath);
			await chatContext.promise;
			return chatContext;
		},
		async onError(error, { chat, path }) {
			console.debug(error);
			finalizeChat(chat, path, formatError(error));
			await logger.dispatch({
				type: 'updateChat',
				data: {
					id: chat.id,
					finished: true,
					messages: chat.messages.toJSON()
				}
			});
		},
		async onSettled(_, __, ___, context) {
			if (!context) return;
			removeNotification(context.notificationId);
		},
		async onSuccess({ newPath, controller }, { chat }, context) {
			finalizeChat(chat, newPath);

			if (chat.title === 'Untitled New Chat' && !controller.signal.aborted) {
				const chunks = getMessagesForPath(currentPath(), chat.messages).expect(
					'should be able to get chunks for path'
				);

				updateNotification(context.notificationId, 'Generating Title and Tags');
				let toastId: null | number | string = null;
				if (isMobile()) toastId = toast.loading('Generating Title');

				({ title: chat.title, tags: chat.tags } = await generateTitleAndTags({
					adapter: openAiAdapter,
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

			await logger.dispatch({
				type: 'updateChat',
				data: { ...chat, messages: chat.messages.toJSON() }
			});
			ChatGenerationManager.removeChat(chat.id);
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
			const shouldCreateNewMessage = message.isNoneOr((message) => message.type !== 'user');
			if (shouldCreateNewMessage) {
				currentNode().addChild(
					new ReactiveTreeNode({
						type: 'user',
						chunks: newChunks
					} as never)
				);
				setCurrentPath((path) => [...path, 0]);
			} else {
				message.unwrap().chunks.push(...newChunks);
			}
		}

		const $chat = chat();
		if (loaderData().isNewChat) {
			await logger.dispatch({
				type: 'createChat',
				data: { ...$chat, messages: $chat.messages.toJSON() }
			});

			setChatsToSend((prev) => [...prev, $chat.id]);
			await navigate({
				to: '/chat/$',
				params: { _splat: slugify($chat.title) },
				search: { id: $chat.id },
				replace: true
			});
			return;
		}

		sendPrompt.mutate({
			path: currentPath(),
			chat: $chat,
			fetcher: fetcher()
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
			fetcher: fetcher()
		});
	}

	function onRegenerate(path: number[]) {
		setCurrentPath(path.slice(0, -1));
		sendPrompt.mutate({
			path: currentPath(),
			chat: chat(),
			fetcher: fetcher()
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
			type: 'updateChat',
			data: { id: chat().id, messages: chat().messages.toJSON() }
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
		const $send = chatsToSend().includes($chat.id);
		if ($send) setChatsToSend((prev) => prev.filter((id) => id !== $chat.id));
		// if (!$send) {
		// 	await Promise.resolve(!$chat.finished).then(async (shouldUpdateFinished) => {
		// 		if (!shouldUpdateFinished) return;
		// 		await logger.dispatch({
		// 			type: 'updateChat',
		// 			data: {
		// 				id: chat().id,
		// 				finished: true,
		// 				messages: $chat.messages.toJSON()
		// 			}
		// 		});
		// 	});
		// }
		await Promise.all([
			Promise.resolve(selectedProvider.data!.id !== $chat.settings.providerId).then(
				async (shouldUpdateProvider) => {
					if (!shouldUpdateProvider) return;
					await logger.dispatch({
						type: 'setUserMetadata',
						data: {
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
						type: 'setUserMetadata',
						data: {
							id: 'selected-model-id',
							value: $chat.settings.model
						}
					});
				}
			)
		]);

		if ($send) handlePrompt('');
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
		setAttachments(
			produce((attachments) => {
				const index = attachments.findIndex((attachment) => attachment.id === id);
				attachments.splice(index, 1);
			})
		);
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
					chatId={loaderData().id}
					class="absolute bottom-0 inset-x-0 will-change-transform bg-card/25 backdrop-blur-xl rounded-lg m-4 border border-input"
					isNewChat={loaderData().isNewChat}
					isPending={sendPrompt.isPending}
					onAbort={() => ChatGenerationManager.abortChat(loaderData().id)}
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
