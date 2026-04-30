import { createWritableMemo } from '@solid-primitives/memo';
import { useQuery } from '@tanstack/solid-query';
import { useLocation } from '@tanstack/solid-router';
import { createMemo, For, Match, Show, Switch } from 'solid-js';

import type { AppDrawerComponentProps } from '~/components/AppDrawer';

import { ChatListSection, QuickActionsSection } from '~/components/ChatList';
import ModelSelector from '~/components/ModelSelector';
import ProviderSelector from '~/components/ProviderSelector';
import { PresetsSection } from '~/components/TheChatSettingsDrawer';
import { Badge } from '~/components/ui/badge';
import { Label } from '~/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';
import {
  SwitchControl,
  SwitchLabel,
  Switch as SwitchPrimitive,
  SwitchThumb
} from '~/components/ui/switch';
import { TextField, TextFieldLabel, TextFieldTextArea } from '~/components/ui/text-field';
import { REASONING_VALUE_TO_LABEL_MAP } from '~/constants/chat-settings';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { type TChatSettings, updateChatSettings } from '~/lib/chat/settings';
import { MCPManager } from '~/lib/mcp/manager';
import { queries } from '~/queries';
import { produce } from '~/utils/immer';

import { chatSettings } from './-state';

export function ChatAppDrawer(props: AppDrawerComponentProps) {
  const location = useLocation();

  const [localSettings, setLocalSettings] = createWritableMemo(() => chatSettings());

  const providers = useQuery(() => queries.providers.all());

  const selectedProviderId = () =>
    localSettings().mapOr('Invalid Settings', (settings) => settings.providerId);
  const selectedProvider = useQuery(() => queries.providers.byId(selectedProviderId()));

  props.onClose(() => {
    const settings = chatSettings()
      .zip(localSettings())
      .mapOr(null, ([chat, local]) => ({ chat, local }));
    if (!settings) {
      console.warn('No settings to save');
      return;
    }
    const hasUnsavedChanges = JSON.stringify(settings.local) !== JSON.stringify(settings.chat);
    if (hasUnsavedChanges) updateChatSettings(settings.local, location());
  });

  const mcpClients = () => MCPManager.getAllClients();

  function updateLocalSettings(fn: (settings: TChatSettings) => void) {
    return setLocalSettings((localSettings) =>
      localSettings.map((localSettings) =>
        produce(localSettings, (localSettings) => void fn(localSettings))
      )
    );
  }

  const adapter = createMemo(() => {
    const token =
      selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data.token : undefined;
    if (!token) return null;
    const url =
      selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data!.baseUrl : null;
    if (!url) return null;
    return new OpenAIAdapter(url, token);
  });

  return (
    <div class="flex flex-col gap-4">
      <div>
        <Label>Provider</Label>
        <ProviderSelector
          onChange={(provider) =>
            updateLocalSettings((settings) => (settings.providerId = provider.id))
          }
          providers={providers.isSuccess ? providers.data : []}
          selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
        ></ProviderSelector>
      </div>
      <div>
        <Label>Model</Label>
        <ModelSelector
          adapter={adapter()}
          onChange={(model) => updateLocalSettings((settings) => (settings.modelId = model.id))}
          selectedModelId={localSettings().mapOr(
            'Invalid Settings',
            (settings) => settings.modelId
          )}
          selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
        ></ModelSelector>
      </div>
      <div class="flex flex-col gap-1.5">
        <Label>Reasoning Effort</Label>
        <Select
          itemComponent={(props) => (
            <SelectItem item={props.item}>
              {REASONING_VALUE_TO_LABEL_MAP[props.item.rawValue]}
            </SelectItem>
          )}
          onChange={(value) =>
            value && updateLocalSettings((settings) => (settings.reasoning = value))
          }
          options={['none', 'minimal', 'low', 'medium', 'high', 'xhigh']}
          value={localSettings().mapOr('medium', (settings) => settings.reasoning)}
        >
          <SelectTrigger>
            <SelectValue<TChatSettings['reasoning']>>
              {(state) => REASONING_VALUE_TO_LABEL_MAP[state.selectedOption()]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>
      <Show when={mcpClients()}>
        <div class="flex flex-col gap-1.5">
          <Label>MCP Clients</Label>
          <div class="flex gap-4 items-center overflow-x-auto">
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
        </div>
      </Show>
      <TextField class="flex flex-col gap-1.5">
        <TextFieldLabel>System Prompt</TextFieldLabel>
        <TextFieldTextArea
          onInput={(e) =>
            updateLocalSettings((settings) => (settings.systemPrompt = e.currentTarget.value))
          }
          placeholder="You are a helpful AI assistant..."
          rows={4}
          value={localSettings().mapOr('', (s) => s.systemPrompt)}
        />
      </TextField>
      <SwitchPrimitive
        checked={localSettings().mapOr(true, (s) => s.includeDateTimeInSystemPrompt)}
        class="flex items-center space-x-2"
        id="includeDateTimeInSystemPrompt"
        onChange={(checked) =>
          updateLocalSettings((settings) => (settings.includeDateTimeInSystemPrompt = checked))
        }
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Include current date/time in system prompt</SwitchLabel>
      </SwitchPrimitive>
      <PresetsSection
        onApplyPreset={(preset) => {
          updateLocalSettings((settings) => {
            Object.assign(settings, preset.settings);
          });
        }}
        settings={localSettings().mapOr(
          {
            modelId: '',
            providerId: '',
            systemPrompt: '',
            reasoning: 'medium' as TChatSettings['reasoning'],
            includeDateTimeInSystemPrompt: true
          },
          (s) => ({
            modelId: s.modelId,
            providerId: s.providerId,
            systemPrompt: s.systemPrompt,
            includeDateTimeInSystemPrompt: s.includeDateTimeInSystemPrompt,
            reasoning: s.reasoning
          })
        )}
      />
      <Separator />
      <QuickActionsSection onClose={props.close} />
      <Separator />
      <ChatListSection onClose={props.close} showGroupLabel sizePx={720} />
    </div>
  );
}

export default ChatAppDrawer;
