import { createActiveElement } from '@solid-primitives/active-element';
import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createElementSize } from '@solid-primitives/resize-observer';
import { createHotkey } from '@tanstack/solid-hotkeys';
import { useMutation } from '@tanstack/solid-query';
import { type NavigateFn, redirect, useBlocker, useRouter } from '@tanstack/solid-router';
import { HLC } from 'hlc';
import { animate } from 'motion';
import { nanoid } from 'nanoid';
import {
  type Accessor,
  batch,
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  onMount,
  Show,
  untrack
} from 'solid-js';
import { unwrap } from 'solid-js/store';
import { toast } from 'solid-sonner';
import { Option } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';
import { SidebarTrigger, useSidebar } from 'ui/sidebar';

import type { TAttachment, TChat, TMessage, TUserMessageChunk } from '~/types/chat';

import { Chat } from '~/components/Chat';
import ThePromptBox from '~/components/ThePromptBox';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { useNotifications } from '~/context/notifications';
import { chatsSchema, type TChat as TDBChat } from '~/db/app-schema';
import { logger } from '~/db/client';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { createTask } from '~/lib/background-task-manager/tasks';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { type TChatSettings } from '~/lib/chat/settings';
import { epubRAGAdapter } from '~/lib/rag/epub';
import { pdfRAGAdapter } from '~/lib/rag/pdf';
import { splitter } from '~/lib/rag/utils';
import { transientDb } from '~/lib/vector-db/transient';
import { fetchers, queries } from '~/queries';
import { isMobile } from '~/signals';
import { account } from '~/signals/account';
import { env } from '~/utils/env';
import { formatError } from '~/utils/errors';
import { compressImageFile, fileToBase64 } from '~/utils/files';
import { produce } from '~/utils/immer';
import { queryClient } from '~/utils/query-client';
import { createWritableMemo } from '~/utils/signals';
import { slugify } from '~/utils/string';
import { Tree, TreeNode, type TTree } from '~/utils/tree';

import {
  addAttachment,
  chatState,
  removeAttachmentById,
  setChatState,
  updateAttachmentById,
  updateChatSettings,
  updateFeedbackEnabled,
  updateMessages,
  updatePrompt
} from './-state';
import { getLatestPath } from './-utils';

export function useChatPage(
  opts: Accessor<{
    chatSettings: TChatSettings;
    id: string;
    isNewChat: boolean;
    loaderChat: null | TDBChat;
    navigate: NavigateFn;
    scratchpad?: boolean;
  }>
) {
  const { navigate } = opts();

  const router = useRouter();

  const [chat, setChat] = createWritableMemo<Omit<TChat, 'messages' | 'settings'>>(() => {
    if (!opts().isNewChat) return opts().loaderChat;
    return {
      finished: true,
      id: opts().id,
      settings: untrack(() => opts().chatSettings),
      tags: [],
      title: 'Untitled New Chat'
    };
  });
  const isPending = ChatGenerationManager.createIsPending(() => opts().id);

  const [, { createNotification, removeNotification }] = useNotifications();

  useBlocker({
    enableBeforeUnload: () => ChatGenerationManager.isPending(opts().id),
    shouldBlockFn: () => false
  });
  onMount(() => updateChatSettings(opts().chatSettings));
  onMount(() => {
    void logger.dispatch({
      data: {
        id: USER_METADATA_KEYS.LAST_OPENED_PAGE,
        value: opts().scratchpad
          ? JSON.stringify({ type: 'scratchpad' })
          : opts().isNewChat
            ? JSON.stringify({ type: 'new-chat' })
            : JSON.stringify({ id: opts().id, title: chat().title, type: 'chat' })
      },
      dontLog: true,
      type: 'setUserMetadata'
    });
  });

  createRenderEffect(() =>
    onCleanup(
      ChatGenerationManager.subscribe(opts().id, ($chat, newPath) => {
        batch(() => {
          setChat({ ...$chat });
          const $currentPath = chatState.path;
          const newPathFollowsCurrentPath =
            newPath.length >= $currentPath.length &&
            newPath.slice(0, $currentPath.length).every((v, i) => v === $currentPath[i]);
          if (newPathFollowsCurrentPath)
            updateMessages({
              messages: $chat.messages,
              path: newPath
            });
          else
            updateMessages({
              messages: $chat.messages
            });
        });
      })
    )
  );

  function purgeOnlyErrorResponses(tree: TTree<TMessage>) {
    const pathsToRemove = [] as number[][];
    const latestPath = getLatestPath(tree);
    for (const { node, path } of tree.walk()) {
      if (node.value.isNone()) continue;
      const message = node.value.unwrap();
      if (message.type !== 'llm') continue;
      if (typeof message.error === 'undefined') continue;
      if (message.chunks.length > 0) continue;
      const isLeafNode = tree.traverse(path).unwrap().children.length === 0;
      if (!isLeafNode) continue;
      const isLatestMessage =
        path.length === latestPath.length &&
        path.every((value, index) => value === latestPath[index]);
      if (isLatestMessage) continue;
      pathsToRemove.push(path);
    }
    for (let i = pathsToRemove.length - 1; i >= 0; i--) {
      tree.removeNodeAndDescendants(pathsToRemove[i]);
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
    const messages = opts().loaderChat?.messages ?? { children: [], value: null };
    untrack(() => {
      const tree = Tree.fromJSON(messages);
      purgeOnlyErrorResponses(tree);
      flushOldToolCalls(tree);
      if (opts().scratchpad) {
        updateMessages({ messages: tree });
      } else {
        updateMessages({ messages: tree, path: getLatestPath(tree) });
      }
    });
  });

  const sendPrompt = useMutation(() => ({
    mutationFn: async ({ id, path }: { id: string; path: number[] }) => {
      const { promise } = await BackgroundTaskManager.scheduleTask(
        createTask(
          {
            arguments: {
              attachements: unwrap(chatState.attachments),
              chatId: id,
              feedbackEnabled: chatState.feedbackEnabled,
              path: unwrap(path),
              scratchpad: Boolean(opts().scratchpad)
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
      if (opts().scratchpad) {
        await router.invalidate();
      }
    }
  }));

  const currentNode = createMemo(() => chatState.messages.traverse(chatState.path).unwrap());
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
      updatePrompt('');
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
          new TreeNode({
            chunks: newChunks,
            type: 'user'
          } as never)
        );
        updateMessages(({ path }) => ({ path: [...path, 0] }));
      } else {
        message.unwrap().chunks.push(...newChunks);
      }
    }

    const $chat = chat();
    const clientId = await logger.getClientId();
    if (opts().scratchpad) {
      await logger.dispatch({
        data: {
          id: USER_METADATA_KEYS.SCRATCHPAD_CHAT,
          value: JSON.stringify(
            chatsSchema.parse(
              produce($chat as TDBChat, (draft) => {
                draft.messages = chatState.messages.toJSON();
                draft.settings = chatState.settings.unwrap();
                if (opts().isNewChat) {
                  const hlc = HLC.generate(clientId);
                  draft.createdAt = hlc.toString();
                  draft.updatedAt = {};
                  draft.accessCount = 0;
                  draft.lastAccessedAt = null;
                }
              })
            )
          )
        },
        dontLog: true,
        type: 'setUserMetadata'
      });
    } else {
      if (opts().isNewChat) {
        await logger.dispatch(
          {
            data: {
              ...$chat,
              messages: chatState.messages.toJSON(),
              settings: chatState.settings.unwrap()
            },
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
          data: { id: $chat.id, messages: chatState.messages.toJSON() },
          type: 'updateChat'
        });
      }
    }
    document.dispatchEvent(new CustomEvent('chat:updated'));
    sendPrompt.mutate({
      id: $chat.id,
      path: chatState.path
    });
  };

  async function onEdit(path: number[], chunkIndex: number, chunk: TUserMessageChunk) {
    const $messages = chatState.messages;
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
      new TreeNode<TMessage>({
        chunks: newChunks,
        type: 'user'
      })
    );
    if (opts().scratchpad) {
      await logger.dispatch({
        data: {
          id: USER_METADATA_KEYS.SCRATCHPAD_CHAT,
          value: JSON.stringify({
            ...chat(),
            messages: $messages.toJSON()
          })
        },
        dontLog: true,
        type: 'setUserMetadata'
      });
    } else {
      await logger.dispatch({
        data: {
          id: chat().id,
          messages: $messages.toJSON()
        },
        type: 'updateChat'
      });
    }
    updateMessages({ path: path.slice(0, -1).concat(parentNode.children.length - 1) });
    sendPrompt.mutate({
      id: chat().id,
      path: chatState.path
    });
  }

  function onRegenerate(path: number[]) {
    updateMessages({ path: path.slice(0, -1) });
    sendPrompt.mutate({ id: chat().id, path: chatState.path });
  }

  async function onTraversal(path: number[], direction: -1 | 1) {
    const rootPath = path.slice(0, -1).concat(path.at(-1)! + direction);
    const $messages = chatState.messages.traverse(rootPath).unwrap();
    const newPath = rootPath.concat(getLatestPath($messages));
    updateMessages({ path: newPath });
  }

  async function onDelete(path: number[], chunkIndex?: number) {
    outer: if (chunkIndex !== undefined) {
      const message = chatState.messages
        .traverse(path)
        .andThen((node) => node.value)
        .expect('should be able to traverse to node and node should have value');
      if (message.chunks.length === 1) break outer;
      if (message.type !== 'user') throw new Error('can only edit user messages');
      message.chunks.splice(chunkIndex, 1);
      return;
    }
    const parentNode = chatState.messages.traverse(path.slice(0, -1)).unwrap();
    updateMessages({ path: path.slice(0, -1) });
    if (parentNode.children.length === 1) {
      parentNode.removeChild(path.at(-1)!);
    } else if (path.at(-1) === parentNode.children.length - 1) {
      parentNode.removeChild(path.at(-1)!);
      onTraversal(path, -1);
    } else {
      parentNode.removeChild(path.at(-1)!);
      updateMessages({ path: path.concat(getLatestPath(parentNode.children[path.at(-1)!])) });
    }
    if (opts().scratchpad) {
      await logger.dispatch({
        data: {
          id: USER_METADATA_KEYS.SCRATCHPAD_CHAT,
          value: JSON.stringify({
            ...chat(),
            messages: chatState.messages.toJSON()
          })
        },
        dontLog: true,
        type: 'setUserMetadata'
      });
    } else {
      await logger.dispatch({
        data: { id: chat().id, messages: chatState.messages.toJSON() },
        type: 'updateChat'
      });
    }
  }

  async function onAttachment(file: File) {
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
          new TreeNode({
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
        updateMessages(({ path }) => ({
          path: [...path, 0]
        }));
      }
    } else if (file.type === 'application/pdf' || file.type === 'application/epub+zip') {
      const id = nanoid();
      const attachment: TAttachment = {
        description: file.name,
        id,
        progress: 0,
        transient: true
      };
      addAttachment(attachment);
      const adapter = file.type === 'application/epub+zip' ? epubRAGAdapter : pdfRAGAdapter;
      const text = (await adapter.getText(file)).unwrap();
      const chunks = splitter.splitText(text);
      await tryBlock(
        async function* () {
          const description = yield* adapter.getDescription(file);
          updateAttachmentById(id, { description });
          await transientDb.indexDocument(chunks.values(), {
            id,
            onProgress: (n) => updateAttachmentById(id, { progress: n / chunks.length })
          });
        },
        (e) => e
      )
        .inspectErr(() => {
          removeAttachmentById(id);
          toast.error('Failed to load document');
        })
        .unwrap();
    } else {
      toast.error('Unsupported file type');
    }
  }

  function onRemoveAttachment(id: string) {
    removeAttachmentById(id);
    void transientDb.deleteDocument(id);
  }

  function onLibraryAttach(newAttachments: TAttachment[]) {
    setChatState((state) =>
      produce(state, (draft) => {
        const attachments = draft.attachments.filter((attachment) => attachment.transient);
        attachments.push(...newAttachments);
        draft.attachments = attachments;
      })
    );
  }

  const activeElement = createActiveElement();

  createHotkey(
    { ctrl: true, key: 'Enter' },
    () => {
      const button = document.getElementById('prompt-submit-button') as HTMLButtonElement;
      if (!button) {
        console.error('submit button missing');
        toast.error('An Error Occurred');
        return;
      }
      button.click();
    },
    () => ({ enabled: activeElement()?.id === 'prompt' })
  );

  function ChatPage(props: { onReset?: () => void; onSave?: () => void }) {
    const sidebar = useSidebar();
    // oxlint-disable-next-line no-unassigned-vars
    let promptBoxRef!: HTMLDivElement;
    const promptBoxSize = createElementSize(() => promptBoxRef);
    const [promptBoxOffset, setPromptBoxOffset] = createSignal(0);
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
            chat={{
              ...chat(),
              messages: chatState.messages.toJSON(),
              settings: chatState.settings.unwrapOr({})
            }}
            class="p-4 [view-transition-name:main-content]"
            onDelete={onDelete}
            onEdit={onEdit}
            onRegenerate={onRegenerate}
            onTraversal={onTraversal}
            path={chatState.path}
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
            attachments={chatState.attachments}
            chatId={opts().id}
            class="absolute bottom-0 inset-x-0 will-change-transform bg-card/25 backdrop-blur-xl rounded-lg m-4 border border-input"
            feedbackEnabled={chatState.feedbackEnabled}
            isNewChat={opts().isNewChat}
            isPending={isPending()}
            onAbort={() => ChatGenerationManager.abortChat(opts().id)}
            onAttachment={onAttachment}
            onFeedbackEnabledChange={updateFeedbackEnabled}
            onInput={updatePrompt}
            onLibraryAttach={onLibraryAttach}
            onMessage={handlePrompt}
            onRemoveAttachment={onRemoveAttachment}
            onReset={props.onReset}
            onSave={props.onSave}
            prompt={chatState.prompt}
            ref={promptBoxRef}
            scratchpad={opts().scratchpad}
            style={{ transform: `translate3d(var(--translate-x-prompt-box, 0), 0, 0)` }}
          />
        </main>
      </div>
    );
  }

  createEventListenerMap(document, {
    'chat:handoff': (event: CustomEvent<{ prefilledPrompt: string }>) => {
      updatePrompt(event.detail.prefilledPrompt);
      navigate({ params: { _splat: 'new' }, to: '/chat/$' });
    }
  });

  return {
    chat,
    ChatPage,
    handlePrompt,
    isPending,
    onAttachment,
    onDelete,
    onEdit,
    onRegenerate,
    onTraversal,
    sendPrompt,
    setChat
  };
}

export async function useChatPageBeforeLoad() {
  const numberOfProviders = await fetchers.providers.countProviders();
  if (numberOfProviders > 0) return;
  if (env.VITE_SYNC_SERVER_BASE_URL && untrack(account) === null)
    throw redirect({ to: '/settings/account' });
  throw redirect({ to: '/settings/providers' });
}
export function useChatPageLoader(opts: { scratchpad?: boolean }) {
  async function ensureValidChatProvider(chat: TDBChat) {
    const provider = await queryClient.ensureQueryData(
      queries.providers.byId(chat.settings.providerId)
    );

    if (provider === null) {
      const providers = await fetchers.providers.getAllProviders();
      Object.assign(chat.settings, {
        model: providers[0].defaultModelIds[0],
        providerId: providers[0].id
      });
      if (!opts.scratchpad) {
        await logger.dispatch({
          data: { id: chat.id, settings: chat.settings },
          type: 'updateChat'
        });
      }
    }
    return chat;
  }

  async function ensureQueryData() {
    const promises = [
      queryClient.ensureQueryData(queries.userMetadata.byId(USER_METADATA_KEYS.SELECTED_MODEL_ID)),
      queryClient.ensureQueryData(queries.userMetadata.byId(USER_METADATA_KEYS.USER_DISPLAY_NAME)),
      queryClient.ensureQueryData(
        queries.userMetadata.byId(USER_METADATA_KEYS.HIDE_REASONING_DURING_GENERATION)
      )
    ] as Promise<unknown>[];
    let scratchpadPromise;
    if (opts.scratchpad) {
      scratchpadPromise = queryClient.fetchQuery(
        queries.userMetadata.byId(USER_METADATA_KEYS.SCRATCHPAD_CHAT)
      );
      promises.push(scratchpadPromise);
    }
    const defaultChatSettingsPresetPromise = queryClient.ensureQueryData(
      queries.userMetadata.byId(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET)
    );
    const providersPromise = queryClient.ensureQueryData(queries.providers.all());
    promises.push(defaultChatSettingsPresetPromise, providersPromise);
    await Promise.all(promises);
    return {
      defaultChatSettingsPreset: await defaultChatSettingsPresetPromise,
      providers: await providersPromise,
      scratchpad: (await scratchpadPromise) ?? null
    };
  }

  return {
    ensureQueryData,
    ensureValidChatProvider
  };
}
