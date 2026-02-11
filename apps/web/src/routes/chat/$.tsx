import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createShortcut } from '@solid-primitives/keyboard';
import { createWritableMemo } from '@solid-primitives/memo';
import { createElementSize } from '@solid-primitives/resize-observer';
import { makePersisted } from '@solid-primitives/storage';
import { useMutation } from '@tanstack/solid-query';
import { createFileRoute, redirect, useBlocker, useRouter } from '@tanstack/solid-router';
import localforage from 'localforage';
import { animate } from 'motion';
import { create } from 'mutative';
import { nanoid } from 'nanoid';
import {
	createEffect,
	createMemo,
	createSignal,
	onCleanup,
	onMount,
	Show,
	untrack
} from 'solid-js';
import { createStore, produce, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { z } from 'zod/mini';

import type { TAttachment, TChat, TMessage, TUserMessageChunk } from '~/types/chat';

import Chat from '~/components/Chat';
import ThePromptBox from '~/components/ThePromptBox';
import { SidebarTrigger, useSidebar } from '~/components/ui/sidebar';
import { useNotifications } from '~/context/notifications';
import { logger } from '~/db/client';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { createTask } from '~/lib/background-task-manager/tasks';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { epubRAGAdapter } from '~/lib/rag/epub';
import { pdfRAGAdapter } from '~/lib/rag/pdf';
import { fetchers, queries } from '~/queries';
import { isMobile } from '~/signals';
import { compressImageFile } from '~/utils/files';
import { fileToBase64 } from '~/utils/files';
import { queryClient } from '~/utils/query-client';
import { slugify } from '~/utils/string';
import { ReactiveTree, ReactiveTreeNode, type TTree } from '~/utils/tree';

import {
	chatSettings,
	feedbackEnabled,
	messages,
	prompt,
	setChatSettings,
	setFeedbackEnabled,
	setMessages,
	setPrompt
} from './-state';

console.error('FIX OPTIMIZE STORAGE');

export const Route = createFileRoute('/chat/$')({
	component: ChatPageComponent,
	validateSearch: z.object({ id: z.optional(z.string()) }),
	loaderDeps: ({ search: { id } }) => ({ id: id ?? nanoid(), isNewChat: id === undefined }),
	shouldReload: ({ deps }) => {
		const { isNewChat } = deps;
		if (isNewChat) return true;
		return undefined;
	},
	beforeLoad: async () => {
		const numberOfProviders = await fetchers.providers.countProviders();
		if (numberOfProviders === 0) throw redirect({ to: '/settings/providers' });
	},
	loader: async ({ deps, params }) => {
		async function ensureValidChatProvider(
			chatId: string,
			defaultProviderId: string,
			defaultModelId: string
		) {
			const chat = await queryClient.fetchQuery(queries.chats.byId(chatId));
			if (chat === null) throw redirect({ to: '/chat/$', params: { _splat: 'new' } });
			const provider = await queryClient.ensureQueryData(
				queries.providers.byId(chat.settings.providerId)
			);

			if (provider === null) {
				Object.assign(chat.settings, { providerId: defaultProviderId, model: defaultModelId });
				await logger.dispatch({
					type: 'updateChat',
					data: { id: chat.id, settings: chat.settings }
				});
			}
			return chat;
		}

		const { id, isNewChat } = deps;
		if (isNewChat && params._splat !== 'new')
			throw redirect({ to: '/chat/$', params: { _splat: 'new' } });

		const [defaultProviderId, defaultModelId] = await Promise.all([
			queryClient.ensureQueryData(queries.userMetadata.byId('default-provider-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('default-model-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('selected-model-id')),
			queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name')),
			queryClient
				.ensureQueryData(queries.userMetadata.byId('cors-proxy-url'))
				.then((proxyUrl) => queryClient.ensureQueryData(queries.mcps.all()._ctx.clients(proxyUrl))),
			queryClient.ensureQueryData(queries.providers.all()),
			queryClient.ensureQueryData(queries.chats.all()._ctx.tags)
		]);

		if (isNewChat) {
			return {
				chat: null,
				isNewChat,
				id,
				chatSettings: {
					modelId: defaultModelId!,
					providerId: defaultProviderId!,
					systemPrompt: ''
				}
			};
		}

		const chat = await ensureValidChatProvider(id, defaultProviderId!, defaultModelId!);

		return { chat, isNewChat, id: chat.id, chatSettings: chat.settings };
	}
});

const [attachments, setAttachments] = makePersisted(createStore<TAttachment[]>([]), {
	name: 'rllm:attachments',
	storage: localforage
});
function ChatPageComponent() {
	const router = useRouter();
	const searchParams = Route.useSearch();
	const loaderData = Route.useLoaderData();
	const navigate = Route.useNavigate();

	const sidebar = useSidebar();
	const [, { createNotification, removeNotification }] = useNotifications();

	useBlocker({
		shouldBlockFn: () => false,
		enableBeforeUnload: () => ChatGenerationManager.isPending(loaderData().id)
	});
	onMount(() => {
		setChatSettings(Option.Some(loaderData().chatSettings));
	});
	onMount(() => {
		onCleanup(
			logger.on('deleteChat', async (event) => {
				if (event.id !== searchParams().id) return;
				navigate({ to: '/chat/$', params: { _splat: 'new' } });
			})
		);
		onCleanup(
			logger.on('updateChat', async (event) => {
				if (event.id !== searchParams().id) return;
				toast.info('Chat updated', {
					id: `updateChat-${searchParams().id}`,
					action: {
						label: 'Reload',
						onClick: async () => {
							await router.invalidate();
							setCurrentPath(getLatestPath(messages()));
						}
					},
					duration: Number.POSITIVE_INFINITY
				});
			})
		);
	});

	let promptBoxRef!: HTMLDivElement;
	const promptBoxSize = createElementSize(() => promptBoxRef);
	const [promptBoxOffset, setPromptBoxOffset] = createSignal(0);

	const [chat, setChat] = createWritableMemo<Omit<TChat, 'messages' | 'settings'>>(() =>
		loaderData().isNewChat ?
			{
				id: loaderData().id,
				title: 'Untitled New Chat',
				finished: true,
				tags: [],
				settings: untrack(() => loaderData().chatSettings)
			}
		:	loaderData().chat!
	);

	const isPending = ChatGenerationManager.createIsPending(() => loaderData().id);

	createEffect(() => {
		const messages = loaderData().chat?.messages;
		if (!messages) return;
		untrack(() => {
			const tree = ReactiveTree.fromJSON(messages);
			setMessages(tree);
			setCurrentPath(getLatestPath(tree));
		});
	});
	onCleanup(() => setMessages(new ReactiveTree<TMessage>()));

	onMount(() =>
		onCleanup(
			ChatGenerationManager.subscribe(loaderData().id, ($chat, path) => {
				setChat({ ...$chat });
				setMessages($chat.messages);
				setCurrentPath(path);
			})
		)
	);

	const [currentPath, setCurrentPath] = createSignal<number[]>(getLatestPath(messages()));
	const currentNode = createMemo(() => messages().traverse(currentPath()).unwrap());

	const sendPrompt = useMutation(() => ({
		onMutate() {
			return { notificationId: createNotification('Generating Response') };
		},
		mutationFn: async ({ path, id }: { id: string; path: number[] }) => {
			const { promise } = await BackgroundTaskManager.scheduleTask(
				createTask(
					{
						type: 'startLLMGeneration',
						arguments: {
							chatId: id,
							path: unwrap(path),
							attachements: unwrap(attachments),
							feedbackEnabled: feedbackEnabled()
						}
					},
					'immediate'
				)
			);
			await promise;
		},
		async onError(error) {
			console.debug(error);
		},
		async onSettled(_, __, ___, context) {
			if (!context) return;
			removeNotification(context.notificationId);
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
				data: { ...$chat, settings: chatSettings().unwrap(), messages: messages().toJSON() }
			});
			await navigate({
				to: '/chat/$',
				params: { _splat: slugify($chat.title) },
				search: { id: $chat.id },
				replace: true
			});
		} else {
			await logger.dispatch({
				type: 'updateChat',
				data: { id: $chat.id, messages: messages().toJSON() }
			});
		}
		sendPrompt.mutate({
			path: currentPath(),
			id: $chat.id
		});
		document.dispatchEvent(new CustomEvent('chat:updated'));
	};

	async function onEdit(path: number[], chunkIndex: number, chunk: TUserMessageChunk) {
		const $messages = messages();
		const node = $messages.traverse(path).expect('should be able to traverse to node');
		const parentNode = node.parent.expect('should have a parent node');
		if (node.value.isSomeAnd((message) => message.type !== 'user')) {
			throw new Error('can only edit user messages');
		}
		const chunks = node.value.expect('should have a value').chunks as TUserMessageChunk[];
		const chunkId = nanoid();
		const newChunks = create(chunks, (chunks) => {
			chunks.splice(
				chunkIndex,
				1,
				create(chunk, (chunk) => {
					chunk.id = chunkId;
				})
			);
		});
		parentNode.addChild(
			new ReactiveTreeNode<TMessage>({
				type: 'user',
				chunks: newChunks
			})
		);
		await logger.dispatch({
			type: 'updateChat',
			data: {
				id: chat().id,
				messages: $messages.toJSON()
			}
		});
		setCurrentPath(path.slice(0, -1).concat(parentNode.children.length - 1));
		sendPrompt.mutate({
			path: currentPath(),
			id: chat().id
		});
	}

	function onRegenerate(path: number[]) {
		setCurrentPath(path.slice(0, -1));
		sendPrompt.mutate({
			path: currentPath(),
			id: chat().id
		});
	}

	async function onTraversal(path: number[], direction: -1 | 1) {
		const rootPath = path.slice(0, -1).concat(path.at(-1)! + direction);
		const $messages = messages().traverse(rootPath).unwrap();
		const newPath = rootPath.concat(getLatestPath($messages));
		setCurrentPath(newPath);
	}

	async function onDelete(path: number[], chunkIndex?: number) {
		outer: if (chunkIndex !== undefined) {
			const message = messages()
				.traverse(path)
				.andThen((node) => node.value)
				.expect('should be able to traverse to node and node should have value');
			if (message.chunks.length === 1) break outer;
			if (message.type !== 'user') throw new Error('can only edit user messages');
			message.chunks.splice(chunkIndex, 1);
			return;
		}
		const parentNode = messages().traverse(path.slice(0, -1)).unwrap();
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
			data: { id: chat().id, messages: messages().toJSON() }
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
					chat={{ ...chat(), messages: messages().toJSON(), settings: chatSettings().unwrapOr({}) }}
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
					feedbackEnabled={feedbackEnabled()}
					isNewChat={loaderData().isNewChat}
					isPending={isPending()}
					onAbort={() => ChatGenerationManager.abortChat(loaderData().id)}
					onAttachment={async (file) => {
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
					}}
					onFeedbackEnabledChange={setFeedbackEnabled}
					onInput={setPrompt}
					onMessage={handlePrompt}
					onRemoveAttachment={(id) => {
						setAttachments(
							produce((attachments) => {
								const index = attachments.findIndex((attachment) => attachment.id === id);
								attachments.splice(index, 1);
							})
						);
					}}
					prompt={prompt()}
					ref={promptBoxRef}
					style={{
						transform: `translate3d(var(--translate-x-prompt-box, 0), 0, 0)`
					}}
				/>
			</main>
		</div>
	);
}

function getLatestPath(messages: TTree<TMessage>, path: number[] = []): number[] {
	if (messages.children.length === 0) return path;
	path.push(messages.children.length - 1);
	return getLatestPath(messages.children[messages.children.length - 1], path);
}
