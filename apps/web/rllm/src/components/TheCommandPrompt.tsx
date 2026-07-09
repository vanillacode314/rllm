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
import { updateChatSettings } from '~/lib/chat/settings';
import { queries } from '~/queries';
import { slugify } from '~/utils/string';

import { useConfirmDialog } from './modals/auto-import/ConfirmDialog';
import { usePromptDialog } from './modals/auto-import/PromptDialog';

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
              condition: () => !isNewChatRoute(),
              handler: () => navigate({ params: { _splat: 'new' }, to: '/chat/$' }),
              icon: 'icon-[heroicons--plus-circle]',
              label: 'New Chat'
            },
            {
              condition: () => {
                if (!isChatRoute()) return false;
                const id = location().search.id;
                if (!id) return false;
                return isChatOpen(location(), id);
              },
              handler: () => deleteChat(location().search.id as string),
              icon: 'icon-[heroicons--trash]',
              label:
                currentChat.isSuccess && currentChat.data
                  ? `Delete Chat (${currentChat.data.title})`
                  : 'Delete Chat'
            },
            {
              condition: () => {
                if (!isChatRoute()) return false;
                const id = location().search.id;
                if (!id) return false;
                return isChatOpen(location(), id);
              },
              handler: async () => {
                if (currentChat.isSuccess) {
                  await renameChat(currentChat.data.id);
                  await router.invalidate();
                } else toast.error('An Error Occured');
              },
              icon: 'icon-[heroicons--pencil-square]',
              label:
                currentChat.isSuccess && currentChat.data
                  ? `Rename Chat (${currentChat.data.title})`
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
                    updateChatSettings(
                      {
                        modelId: model.id,
                        providerId: provider.id
                      },
                      location()
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
            handler: () => updateChatSettings(preset.settings, location()),
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
    if (isChatOpen(location(), id)) {
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
    if (isChatOpen(location(), id)) {
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
