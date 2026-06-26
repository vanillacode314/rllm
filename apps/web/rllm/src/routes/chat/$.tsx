import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createShortcut } from '@solid-primitives/keyboard';
import { createWritableMemo } from '@solid-primitives/memo';
import { createElementSize } from '@solid-primitives/resize-observer';
import { makePersisted } from '@solid-primitives/storage';
import { useMutation } from '@tanstack/solid-query';
import { createFileRoute, redirect, useBlocker, useRouter } from '@tanstack/solid-router';
import localforage from 'localforage';
import { animate } from 'motion';
import { nanoid } from 'nanoid';
import {
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  untrack
} from 'solid-js';
import { createStore, unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { z } from 'zod/mini';

import type { TAttachment, TChat, TMessage, TUserMessageChunk } from '~/types/chat';

import { useAppDrawer } from '~/components/AppDrawer';
import Chat from '~/components/Chat';
import ThePromptBox from '~/components/ThePromptBox';
import { SidebarTrigger, useSidebar } from 'ui/sidebar';
import { FALLBACK_CHAT_SETTINGS } from '~/constants/chat-settings';
import { useNotifications } from '~/context/notifications';
import { logger } from '~/db/client';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { createTask } from '~/lib/background-task-manager/tasks';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { chatSettingsSchema } from '~/lib/chat/settings';
import { epubRAGAdapter } from '~/lib/rag/epub';
import { pdfRAGAdapter } from '~/lib/rag/pdf';
import { fetchers, queries } from '~/queries';
import { isMobile } from '~/signals';
import { formatError } from '~/utils/errors';
import { compressImageFile } from '~/utils/files';
import { fileToBase64 } from '~/utils/files';
import { produce } from '~/utils/immer';
import { queryClient } from '~/utils/query-client';
import { slugify } from '~/utils/string';
import { ReactiveTree, ReactiveTreeNode, type TTree } from '~/utils/tree';

import ChatAppDrawer from './-ChatAppDrawer';
import { INCREMENT_ACCESS_COUNT_THRESHOLD_MILLISECONDS } from './-constants';
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
  beforeLoad: async () => {
    const numberOfProviders = await fetchers.providers.countProviders();
    if (numberOfProviders === 0) throw redirect({ to: '/settings/providers' });
  },
  component: ChatPageComponent,
  loaderDeps: ({ search: { id } }) => ({ id: id ?? nanoid(), isNewChat: id === undefined }),
  // oxlint-disable-next-line perfectionist/sort-objects
  loader: async ({ deps, params }) => {
    async function ensureValidChatProvider(
      chatId: string,
      defaultProviderId: string,
      defaultModelId: string
    ) {
      const chat = await queryClient.fetchQuery(queries.chats.byId(chatId));
      if (chat === null) throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });
      const provider = await queryClient.ensureQueryData(
        queries.providers.byId(chat.settings.providerId)
      );

      if (provider === null) {
        Object.assign(chat.settings, { model: defaultModelId, providerId: defaultProviderId });
        await logger.dispatch({
          data: { id: chat.id, settings: chat.settings },
          type: 'updateChat'
        });
      }
      return chat;
    }

    const { id, isNewChat } = deps;
    if (isNewChat && params._splat !== 'new')
      throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });

    const [defaultProviderId, defaultModelId, defaultChatSettingsPresetId] = await Promise.all([
      queryClient.ensureQueryData(queries.userMetadata.byId('default-provider-id')),
      queryClient.ensureQueryData(queries.userMetadata.byId('default-model-id')),
      queryClient.ensureQueryData(queries.userMetadata.byId('default-chat-settings-preset')),
      queryClient.ensureQueryData(queries.userMetadata.byId('selected-model-id')),
      queryClient.ensureQueryData(queries.userMetadata.byId('user-display-name')),
      queryClient.ensureQueryData(queries.providers.all()),
      queryClient.ensureQueryData(queries.chats.all()._ctx.tags)
    ]);

    if (isNewChat) {
      if (defaultChatSettingsPresetId) {
        const preset = await fetchers.chatPresets.byId(defaultChatSettingsPresetId);
        return {
          chat: null,
          chatSettings: {
            ...FALLBACK_CHAT_SETTINGS(defaultModelId!, defaultProviderId!),
            ...preset.settings
          },
          id,
          isNewChat
        };
      }
      return {
        chat: null,
        chatSettings: FALLBACK_CHAT_SETTINGS(defaultModelId!, defaultProviderId!),
        id,
        isNewChat
      };
    }

    const chat = await ensureValidChatProvider(id, defaultProviderId!, defaultModelId!);

    return {
      chat,
      chatSettings: chat.settings,
      id: chat.id,
      isNewChat
    };
  },
  shouldReload: ({ deps }) => {
    const { isNewChat } = deps;
    if (isNewChat) return true;
    return undefined;
  },
  validateSearch: z.object({ id: z.optional(z.string()) })
});

const [attachments, setAttachments] = makePersisted(createStore<TAttachment[]>([]), {
  name: 'rllm:attachments',
  storage: localforage
});
function ChatPageComponent() {
  const appDrawer = useAppDrawer();
  appDrawer.setContent(ChatAppDrawer);
  const router = useRouter();
  const searchParams = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();

  const sidebar = useSidebar();
  const [, { createNotification, removeNotification }] = useNotifications();

  useBlocker({
    enableBeforeUnload: () => ChatGenerationManager.isPending(loaderData().id),
    shouldBlockFn: () => false
  });
  onMount(() => {
    setChatSettings(Option.Some(chatSettingsSchema.parse(loaderData().chatSettings)));
  });
  onMount(async () => {
    const { chat, isNewChat } = loaderData();
    const id = searchParams().id;

    if (!id || isNewChat || !chat) return;

    const lastAccessedAt = chat.lastAccessedAt;
    if (
      typeof lastAccessedAt === 'number' &&
      Date.now() - lastAccessedAt < INCREMENT_ACCESS_COUNT_THRESHOLD_MILLISECONDS
    )
      return;
    await logger.dispatch({
      data: { id },
      type: 'incrementChatAccessCount'
    });
  });
  onMount(() => {
    onCleanup(
      logger.on(
        'deleteChat',
        async (event) => {
          if (event.id !== searchParams().id) return;
          navigate({ params: { _splat: 'new' }, to: '/chat/$' });
        },
        { self: true }
      )
    );
    onCleanup(
      logger.on('updateChat', async (event) => {
        if (event.id !== searchParams().id) return;
        toast.info('Chat updated', {
          action: {
            label: 'Reload',
            onClick: async () => {
              await router.invalidate();
              setCurrentPath(getLatestPath(messages()));
            }
          },
          duration: Number.POSITIVE_INFINITY,
          id: `updateChat-${searchParams().id}`
        });
      })
    );
  });

  // oxlint-disable-next-line no-unassigned-vars
  let promptBoxRef!: HTMLDivElement;
  const promptBoxSize = createElementSize(() => promptBoxRef);
  const [promptBoxOffset, setPromptBoxOffset] = createSignal(0);

  const [chat, setChat] = createWritableMemo<Omit<TChat, 'messages' | 'settings'>>(() =>
    loaderData().isNewChat
      ? {
          finished: true,
          id: loaderData().id,
          settings: untrack(() => loaderData().chatSettings),
          tags: [],
          title: 'Untitled New Chat'
        }
      : loaderData().chat!
  );

  const isPending = ChatGenerationManager.createIsPending(() => loaderData().id);

  onCleanup(() => setMessages(new ReactiveTree<TMessage>()));

  onMount(() =>
    createEventListenerMap(document, {
      'chat:handoff': (event: CustomEvent<{ prefilledPrompt: string }>) => {
        setPrompt(event.detail.prefilledPrompt);
        navigate({ params: { _splat: 'new' }, to: '/chat/$' });
      }
    })
  );

  onMount(() =>
    onCleanup(
      ChatGenerationManager.subscribe(loaderData().id, ($chat, newPath) => {
        setChat({ ...$chat });
        setMessages($chat.messages);
        const $currentPath = currentPath();
        const newPathFollowsCurrentPath =
          newPath.length >= $currentPath.length &&
          newPath.slice(0, $currentPath.length).every((v, i) => v === $currentPath[i]);
        if (newPathFollowsCurrentPath) setCurrentPath(newPath);
      })
    )
  );

  const [currentPath, setCurrentPath] = createSignal<number[]>(getLatestPath(messages()));
  const currentNode = createMemo(() => messages().traverse(currentPath()).unwrap());

  function purgeOnlyErrorResponses(tree: TTree<TMessage>) {
    const pathsToRemove = [] as number[][];
    for (const { node, path } of tree.walk()) {
      if (node.value.isNone()) continue;
      const message = node.value.unwrap();
      if (message.type !== 'llm') continue;
      if (typeof message.error === 'undefined') continue;
      if (message.chunks.length > 0) continue;
      const isLastMessage = tree.traverse(path).unwrap().children.length === 0;
      if (!isLastMessage) continue;
      pathsToRemove.push(path);
    }
    for (const path of pathsToRemove.toReversed()) {
      tree.removeNodeAndDescendants(path);
    }
  }

  function flushOldToolCalls(tree: TTree<TMessage>) {
    for (const { node } of tree.walk()) {
      if (node.value.isNone()) continue;
      const message = node.value.unwrap();
      if (message.type !== 'llm') continue;
      for (const chunk of message.chunks) {
        if (chunk.type !== 'tool_call') continue;
        if (chunk.success !== null) continue;
        chunk.success = false;
        chunk.content = formatError(new Error('Failed to execute tool'));
      }
    }
  }

  createRenderEffect(() => {
    const messages = loaderData().chat?.messages;
    if (!messages) return;
    untrack(() => {
      const tree = ReactiveTree.fromJSON(messages);
      purgeOnlyErrorResponses(tree);
      flushOldToolCalls(tree);
      setMessages(tree);
      setCurrentPath(getLatestPath(tree));
    });
  });

  const sendPrompt = useMutation(() => ({
    mutationFn: async ({ id, path }: { id: string; path: number[] }) => {
      const { promise } = await BackgroundTaskManager.scheduleTask(
        createTask(
          {
            arguments: {
              attachements: unwrap(attachments),
              chatId: id,
              feedbackEnabled: feedbackEnabled(),
              path: unwrap(path)
            },
            type: 'startLLMGeneration'
          },
          'immediate'
        )
      );
      await promise;
    },
    async onError(error) {
      console.debug(error);
    },
    onMutate() {
      return { notificationId: createNotification('Generating Response') };
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
      (message) => message.type !== 'user' || message.chunks.length === 0
    );
    if (isPromptEmpty && shouldAddPrompt) {
      toast.error('Prompt is empty');
      return;
    }

    if (shouldAddPrompt) {
      setPrompt('');
      const chunkId = nanoid();
      const message = currentMessageIsUserMessage
        ? currentMessage
        : Option.from(currentNode().children[0]).andThen((node) => node.value);

      const newChunks = [
        {
          content: prompt,
          id: chunkId,
          type: 'text'
        }
      ] as const;
      const shouldCreateNewMessage = message.isNoneOr((message) => message.type !== 'user');
      if (shouldCreateNewMessage) {
        currentNode().addChild(
          new ReactiveTreeNode({
            chunks: newChunks,
            type: 'user'
          } as never)
        );
        setCurrentPath((path) => [...path, 0]);
      } else {
        message.unwrap().chunks.push(...newChunks);
      }
    }

    const $chat = chat();
    if (loaderData().isNewChat) {
      await logger.dispatch(
        {
          data: { ...$chat, messages: messages().toJSON(), settings: chatSettings().unwrap() },
          type: 'createChat'
        },
        {
          data: { id: $chat.id },
          type: 'incrementChatAccessCount'
        }
      );
      await navigate({
        params: { _splat: slugify($chat.title) },
        replace: true,
        search: { id: $chat.id },
        to: '/chat/$'
      });
    } else {
      await logger.dispatch({
        data: { id: $chat.id, messages: messages().toJSON() },
        type: 'updateChat'
      });
    }
    sendPrompt.mutate({
      id: $chat.id,
      path: currentPath()
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
    const newChunks = produce(chunks, (chunks) => {
      chunks.splice(
        chunkIndex,
        1,
        produce(chunk, (chunk) => {
          chunk.id = chunkId;
        })
      );
    });
    parentNode.addChild(
      new ReactiveTreeNode<TMessage>({
        chunks: newChunks,
        type: 'user'
      })
    );
    await logger.dispatch({
      data: {
        id: chat().id,
        messages: $messages.toJSON()
      },
      type: 'updateChat'
    });
    setCurrentPath(path.slice(0, -1).concat(parentNode.children.length - 1));
    sendPrompt.mutate({
      id: chat().id,
      path: currentPath()
    });
  }

  function onRegenerate(path: number[]) {
    setCurrentPath(path.slice(0, -1));
    sendPrompt.mutate({
      id: chat().id,
      path: currentPath()
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
      data: { id: chat().id, messages: messages().toJSON() },
      type: 'updateChat'
    });
  }

  createShortcut(
    ['Control', 'Enter'],
    (event) => {
      if (!event) return;
      if (document.activeElement?.id === 'prompt') {
        event.preventDefault();
        const button = document.getElementById('prompt-submit-button') as HTMLButtonElement;
        if (!button) {
          console.error('submit button missing');
          toast.error('An Error Occurred');
          return;
        }
        button.click();
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
          isMobile()
            ? {
                '--bottom-arrow': `calc(${promptBoxSize.height ?? 0}px + var(--spacing) * 8)`,
                '--translate-x-prompt-box': `${promptBoxOffset()}px`,
                '--translate-y-arrow': `${
                  promptBoxOffset() > (promptBoxSize?.width ?? 0) * 0.6
                    ? promptBoxOffset() *
                      ((promptBoxSize?.height ?? 0) / (promptBoxSize?.width ?? 1))
                    : 0
                }px`
              }
            : {
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
                damping: 25,
                onUpdate: (offset) => setPromptBoxOffset(offset),
                stiffness: 300,
                type: 'spring'
              });
            };
            createEventListenerMap(
              () => el,
              {
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
                },
                touchstart: (event) => {
                  if (el.scrollHeight - el.clientHeight <= 30) return;
                  touchId = event.touches[0].identifier;
                  start = event.touches[0].clientY;
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
          class="absolute bottom-0 right-0 bg-transparent h-45 w-10 z-10"
          inert={promptBoxOffset() < (promptBoxSize.width ?? 0) * 0.9 || !isMobile()}
          onClick={() => {
            animate(promptBoxOffset(), 0, {
              damping: 20,
              onUpdate: (offset) => setPromptBoxOffset(offset),
              stiffness: 300,
              type: 'spring'
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
                maxHeight: 700,
                maxWidth: 700,
                quality: 0.8,
                retainExif: false
              }).unwrap();
              const chunkId = nanoid();
              const currentMessage = currentNode().value;
              const currentMessageIsUserMessage = currentMessage.isSomeAnd(
                (message) => message.type === 'user'
              );
              const message = currentMessageIsUserMessage
                ? currentMessage
                : Option.from(currentNode().children[0]).andThen((node) => node.value);
              const url = await fileToBase64(compressedFile as File);
              if (message.isSomeAnd((message) => message.type === 'user')) {
                message.unwrap().chunks.push({
                  filename: file.name,
                  id: chunkId,
                  mimeType: file.type,
                  type: 'image_url',
                  url
                });
              } else {
                currentNode().addChild(
                  new ReactiveTreeNode({
                    chunks: [
                      {
                        filename: file.name,
                        id: chunkId,
                        mimeType: file.type,
                        type: 'image_url',
                        url
                      }
                    ],
                    type: 'user'
                  })
                );
                setCurrentPath((path) => [...path, 0]);
              }
            } else if (file.type === 'application/pdf' || file.type === 'application/epub+zip') {
              const id = nanoid();
              const attachment = { description: file.name, documents: [], id, progress: 0 };
              const adapter = file.type === 'application/epub+zip' ? epubRAGAdapter : pdfRAGAdapter;
              const idx = attachments.length;
              setAttachments(
                produce((attachments) => {
                  attachments.push(attachment);
                })
              );
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
            setAttachments((attachments) =>
              produce(attachments, (attachments) => {
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
