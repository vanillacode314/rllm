import { useNavigate } from '@tanstack/solid-router';
import { For, type JSX, Match, Show, splitProps, Switch } from 'solid-js';

import type { TAttachment } from '~/types/chat';

import { logger } from '~/db/client';
import { MCPManager } from '~/lib/mcp/manager';
import { chatSettings } from '~/routes/chat/-state';
import { getFile } from '~/utils/files';
import { cn } from '~/utils/tailwind';

import { useAppDrawer } from './AppDrawer';
import { ExpandableTextField } from './ExpandableTextField';
import { useConfirmDialog } from './modals/auto-import/ConfirmDialog';
import { setChatSettingsDrawerOpen } from './TheChatSettingsDrawer';
import { setCommandPromptOpen } from './TheCommandPrompt';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from './ui/dropdown-menu';

type Props = Omit<JSX.HTMLAttributes<HTMLDivElement>, 'onInput'> & {
  attachments: TAttachment[];
  chatId?: string;
  class?: string | undefined;
  feedbackEnabled: boolean;
  inputRef?: ((el: HTMLTextAreaElement) => void) | HTMLTextAreaElement;
  isNewChat: boolean;
  isPending: boolean;
  onAbort: () => void;
  onAttachment: (file: File) => void;
  onFeedbackEnabledChange: (enabled: boolean) => void;
  onInput: (value: string) => void;
  onMessage: (value: string) => void;
  onRemoveAttachment: (id: string) => void;
  prompt: string;
};
export function PromptBox(props: Props) {
  const [local, others] = splitProps(props, [
    'class',
    'chatId',
    'inputRef',
    'isNewChat',
    'isPending',
    'onAbort',
    'onInput',
    'prompt',
    'attachments',
    'onMessage',
    'onRemoveAttachment',
    'onAttachment',
    'feedbackEnabled',
    'onFeedbackEnabledChange'
  ]);

  const appDrawer = useAppDrawer();

  return (
    <div class={cn('[view-transition-name:prompt-box] flex flex-col', local.class)} {...others}>
      <ExpandableTextField
        class="bg-transparent border-none p-4 pb-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        id="prompt"
        name="prompt"
        onInput={(e) => local.onInput(e.currentTarget.value)}
        onPaste={(e) => {
          const data = e.clipboardData;
          if (!data) return;
          for (let i = 0; i < data.items.length; i++) {
            const item = data.items[i];
            if (item.kind === 'file') {
              const file = item.getAsFile();
              if (!file) continue;
              props.onAttachment(file);
            }
          }
        }}
        placeholder="Message"
        ref={local.inputRef}
        value={local.prompt}
      />
      <Show when={local.attachments.length > 0}>
        <ul class="p-4 flex gap-4 pb-0 overflow-x-auto">
          <For each={local.attachments}>
            {(attachment) => (
              <li
                class="grid grid-cols-[auto_1fr_auto] gap-2 items-center bg-primary/20 p-2 rounded-lg max-w-48 relative before:absolute before:inset-0 before:bg-primary/20  before:origin-left before:scale-x-[var(--progress)] before:transition-transform overflow-hidden"
                style={{
                  '--progress': attachment.progress
                }}
                title={attachment.description}
              >
                <span
                  class={cn(
                    attachment.progress < 1
                      ? 'icon-[svg-spinners--180-ring-with-bg]'
                      : 'icon-[heroicons--document]'
                  )}
                />
                <h4 class="text-xs font-semibold uppercase tracking-wider truncate">
                  {attachment.description}
                </h4>
                <Button
                  class="size-6"
                  disabled={attachment.progress < 1}
                  onClick={() => props.onRemoveAttachment(attachment.id)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <span class="icon-[heroicons--x-mark]" />
                </Button>
              </li>
            )}
          </For>
        </ul>
      </Show>
      <Toolbar
        chatId={local.chatId}
        feedbackEnabled={local.feedbackEnabled}
        isNewChat={local.isNewChat}
        isPending={local.isPending}
        onAbort={local.onAbort}
        onAttachment={props.onAttachment}
        onFeedbackEnabledChange={local.onFeedbackEnabledChange}
        onRemoveAttachment={props.onRemoveAttachment}
        onSubmit={() => props.onMessage(local.prompt)}
      />
      <button
        class="md:hidden grid place-content-center py-1 px-2 bg-secondary/20 rounded-b"
        onClick={appDrawer.open}
      >
        <span class="text-sm icon-[heroicons--chevron-up]" />
      </button>
    </div>
  );
}

function Toolbar(props: {
  chatId?: string;
  feedbackEnabled: boolean;
  isNewChat: boolean;
  isPending: boolean;
  onAbort: () => void;
  onAttachment: (file: File) => void;
  onFeedbackEnabledChange: (enabled: boolean) => void;
  onRemoveAttachment: (id: string) => void;
  onSubmit: () => void;
}) {
  const mcpClients = () => MCPManager.getAllClients();
  const modelId = () => chatSettings().mapOr('Invalid Settings', (settings) => settings.modelId);

  const navigate = useNavigate();
  const confirmDialog = useConfirmDialog();

  function simplifyModelId(id: string): string {
    if (!id.includes('/')) return id;
    const index = id.lastIndexOf('/');
    return id.slice(index + 1);
  }

  return (
    <div class="flex gap-2 flex-col p-4">
      <div class="flex gap-2">
        <Show when={!props.isNewChat}>
          <Button
            class="shrink-0"
            disabled={props.isPending}
            onClick={async () => {
              if (
                !(await confirmDialog.confirm({
                  description: 'Are you sure you want to delete this chat?',
                  title: 'Delete Chat'
                }))
              )
                return;
              await logger.dispatch({
                data: { id: props.chatId! },
                type: 'deleteChat'
              });
            }}
            size="icon"
            type="button"
            variant="outline"
          >
            <span class="icon-[heroicons--trash] text-xl" />
            <span class="sr-only">Delete chat</span>
          </Button>
        </Show>
        <Show when={mcpClients()}>
          <div class="flex gap-4 items-center overflow-x-auto max-md:hidden">
            <For each={mcpClients()}>
              {(client) => (
                <button
                  onClick={() =>
                    client.status === 'connected' ? client.disconnect() : client.initSession()
                  }
                  type="button"
                >
                  <Badge
                    class="flex gap-1 items-center"
                    variant={client.status === 'connected' ? 'success' : 'outline'}
                  >
                    <Switch>
                      <Match when={client.status === 'connecting'}>
                        <span class="icon-[svg-spinners--180-ring-with-bg]" />
                      </Match>
                      <Match when={client.status === 'connected'}>
                        <span class="icon-[heroicons--check-circle]" />
                      </Match>
                      <Match when={client.status === 'disconnected'}>
                        <span class="icon-[heroicons--x-circle]" />
                      </Match>
                    </Switch>
                    <span>{client.name}</span>
                  </Badge>
                </button>
              )}
            </For>
          </div>
        </Show>
        <span class="grow" />
        <div class="flex">
          <Show when={!props.isNewChat}>
            <Button
              class="border-px border-r-0"
              onClick={() => {
                navigate({ params: { _splat: 'new' }, to: '/chat/$' });
              }}
              size="icon"
              type="button"
              variant="outline"
            >
              <span class="icon-[heroicons--plus] text-xl" />
              <span class="sr-only">New chat</span>
            </Button>
          </Show>
          <Button
            class="border-px flex gap-2 items-center max-w-36 sm:max-w-48 md:max-w-64 max-sm:hidden"
            onClick={() => {
              setChatSettingsDrawerOpen(true);
            }}
            type="button"
            variant="outline"
          >
            <span class="max-sm:hidden text-xs truncate">{simplifyModelId(modelId())}</span>
            <span class="sr-only">Chat settings</span>
            <span class="shrink-0 icon-[heroicons--cog-6-tooth] text-xl" />
          </Button>
          <Button
            class="border-px max-md:hidden"
            onClick={() => {
              setCommandPromptOpen(true);
            }}
            size="icon"
            type="button"
            variant="outline"
          >
            <span class="sr-only">Command prompt</span>
            <span class="icon-[heroicons--command-line] text-xl" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              as={Button<'button'>}
              class="border-px max-sm:hidden"
              disabled={props.isPending}
              size="icon"
              variant="outline"
            >
              <span class="icon-[heroicons--paper-clip] text-xl" />
              <span class="sr-only">Attach File</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent class="w-48">
              <DropdownMenuItem
                onSelect={async () => {
                  const file = await getFile('image/*');
                  if (file) props.onAttachment(file);
                }}
              >
                <span>Image</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={async () => {
                  const file = await getFile('application/epub+zip application/pdf');
                  if (file) props.onAttachment(file);
                }}
              >
                <span>PDF/Epub</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            class="border-px rounded-r-md"
            onClick={() => props.onFeedbackEnabledChange(!props.feedbackEnabled)}
            size="icon"
            type="button"
            variant={props.feedbackEnabled ? 'default' : 'outline'}
          >
            <span class="sr-only">Feedback</span>
            <span class="icon-[heroicons--chat-bubble-left-right] text-xl" />
          </Button>
          <Show
            fallback={
              <Button onClick={() => props.onAbort()} size="icon" type="button" variant="secondary">
                <span class="icon-[svg-spinners--180-ring-with-bg] text-xl" />
                <span class="sr-only">Cancel</span>
              </Button>
            }
            when={!props.isPending}
          >
            <Button
              id="prompt-submit-button"
              onClick={() => props.onSubmit()}
              size="icon"
              type="button"
              variant="secondary"
            >
              <span class="icon-[heroicons--arrow-right] text-xl" />
              <span class="sr-only">Send message</span>
            </Button>
          </Show>
        </div>
      </div>
    </div>
  );
}

export default PromptBox;
