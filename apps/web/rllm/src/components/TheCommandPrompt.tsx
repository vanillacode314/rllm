import { createHotkeys } from '@tanstack/solid-hotkeys';
import { useQuery } from '@tanstack/solid-query';
import { useLocation, useNavigate, useRouter } from '@tanstack/solid-router';
import { batch, createMemo, createSignal, For, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from 'ui/command';

import { SETTINGS_PAGES } from '~/constants/settings';
import { logger } from '~/db/client';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { saveChatSettings } from '~/lib/chat/settings';
import { queries } from '~/queries';
import { slugify } from '~/utils/string';

import { useConfirmDialog } from './modals/auto-import/ConfirmDialog';
import { usePromptDialog } from './modals/auto-import/PromptDialog';
import { useChatState } from '~/context/chat';

interface TItem {
  condition?: () => boolean;
  handler: (value: string) => Promise<void> | void;
  icon?: string;
  keywords?: string[];
  label: string;
  noClose?: boolean;
  value?: string;
}

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

  createHotkeys([
    { callback: () => setCommandPromptOpen((open) => !open), hotkey: { ctrl: true, key: 'K' } },
    { callback: () => setCommandPromptOpen((open) => !open), hotkey: { key: 'K', meta: true } }
  ]);

  const navigate = useNavigate();
  const location = useLocation();
  const chatState = useChatState();
  const router = useRouter();

  const providers = useQuery(() => queries.providers.all());
  const adapters = createMemo(() =>
    (providers.isSuccess ? providers.data : []).map((provider) => ({
      adapter: new OpenAIAdapter(provider.baseUrl, provider.token),
      provider
    }))
  );
  const models = useQuery(() => ({
    queryFn: async () => {
      const models = await Promise.all(
        adapters().map(async ({ adapter, provider }) => {
          return {
            models: await adapter
              .fetchAllModels()
              .unwrapOrElse(() => provider.defaultModelIds.map((id) => ({ id }))),
            provider
          };
        })
      );
      return models;
    },
    queryKey: ['models', 'all'],
    staleTime: 0
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
            handler: () => {
              navigate({
                params: { _splat: slugify(chat.title) },
                search: { id: chat.id },
                to: '/chat/$'
              });
            },
            keywords: [`#${chat.title}`],
            label: chat.title,
            value: chat.id
          }))
        };
      case 'default':
        return {
          Actions: [
            {
              condition: () => !chatState.isNewChatRoute,
              handler: () => navigate({ params: { _splat: 'new' }, to: '/chat/$' }),
              icon: 'icon-[heroicons--plus-circle]',
              label: 'New Chat'
            },
            {
              condition: () => chatState.currentChatId !== undefined,
              handler: () => deleteChat(chatState.currentChatId!),
              icon: 'icon-[heroicons--trash]',
              label:
                chatState.currentChat.isSuccess && chatState.currentChat.data
                  ? `Delete Chat (${chatState.currentChat.data.title})`
                  : 'Delete Chat'
            },
            {
              condition: () => chatState.currentChatId !== undefined,
              handler: async () => {
                if (chatState.currentChat.isSuccess) {
                  await renameChat(chatState.currentChat.data.id);
                  await router.invalidate();
                } else toast.error('An Error Occured');
              },
              icon: 'icon-[heroicons--pencil-square]',
              label:
                chatState.currentChat.isSuccess && chatState.currentChat.data
                  ? `Rename Chat (${chatState.currentChat.data.title})`
                  : 'Rename Chat'
            }
          ],
          Default: [],
          Settings: SETTINGS_PAGES.map((page) => ({
            condition: () =>
              (page.condition?.() ?? true) && !location().pathname.startsWith(page.path),
            handler: () => navigate({ href: page.path }),
            icon: page.icon ?? 'icon-[heroicons--cog-6-tooth]',
            label: page.name
          }))
        };
      case 'models':
        return {
          'Switch Model': models.isSuccess
            ? models.data.flatMap(({ models, provider }) =>
                models.map((model) => ({
                  handler: () => {
                    saveChatSettings(
                      {
                        modelId: model.id,
                        providerId: provider.id
                      },
                      { chatId: chatState.currentChatId, scratchpad: chatState.isScratchpadRoute }
                    );
                  },
                  keywords: [`@${model.id} ${provider.name}`],
                  label: `${model.id} (${provider.name})`,
                  value: `${provider.id}/${model.id}`
                }))
              )
            : []
        };
      case 'presets':
        return {
          'Switch Preset': presets().map((preset) => ({
            handler: async () => {
              try {
                await saveChatSettings(preset.settings, {
                  chatId: chatState.currentChatId,
                  scratchpad: chatState.isScratchpadRoute
                });
                toast.success(`Preset "${preset.name}" loaded`);
              } catch (error) {
                console.error(error);
                toast.error('Failed to load preset');
              }
            },
            keywords: [`:${preset.name}`],
            label: preset.name,
            value: preset.id
          }))
        };
    }
  });

  const confirmDialog = useConfirmDialog();
  const promptDialog = usePromptDialog();
  async function renameChat(id: string) {
    const title = await promptDialog.prompt({
      description: 'Enter a new title for this chat',
      title: 'Rename Chat'
    });
    if (!title) return;
    await logger.dispatch({
      data: { id, title },
      type: 'updateChat'
    });
    if (chatState.currentChatId === id) {
      await navigate({
        params: { _splat: slugify(title) },
        search: { id },
        to: '/chat/$'
      });
    }
  }

  async function deleteChat(id: string) {
    if (
      !(await confirmDialog.confirm({
        description: 'Are you sure you want to delete this chat?',
        title: 'Delete Chat'
      }))
    )
      return;
    if (chatState.currentChatId === id) {
      await navigate({ params: { _splat: 'new' }, to: '/chat/$' });
    }
    await logger.dispatch({
      data: { id },
      type: 'deleteChat'
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
      <div class="p-px items-center gap-px bg-muted grid md:grid-cols-3">
        <span class="bg-secondary text-secondary-foreground p-2 text-xs uppercase font-semibold tracking-wider">
          @: Switch Model
        </span>
        <span class="bg-secondary text-secondary-foreground p-2 text-xs uppercase font-semibold tracking-wider">
          #: Goto Chat
        </span>
        <span class="bg-secondary text-secondary-foreground p-2 text-xs uppercase font-semibold tracking-wider">
          :: Switch Preset
        </span>
      </div>
    </CommandDialog>
  );
}

export { commandPromptOpen, setCommandPromptOpen };
export default TheCommandPrompt;
