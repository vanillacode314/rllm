import { useQuery, useQueryClient } from '@tanstack/solid-query';
import { createMemo, createSignal, For, Match, Show, Switch } from 'solid-js';
import { Badge } from 'ui/badge';
import { Button } from 'ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from 'ui/dialog';
import { Label } from 'ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'ui/select';
import { SwitchControl, SwitchLabel, Switch as SwitchPrimitive, SwitchThumb } from 'ui/switch';
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from 'ui/text-field';
import { cn } from 'ui/utils/tailwind';

import type { TModel, TProvider } from '~/types';

import { REASONING_VALUE_TO_LABEL_MAP } from '~/constants/chat-settings';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { createPreset, type TChatPreset } from '~/lib/chat/presets';
import { type TChatSettings } from '~/lib/chat/settings';
import { MCPManager } from '~/lib/mcp/manager';
import { queries } from '~/queries';

import ModelSelector from './ModelSelector';
import PresetSelector from './PresetSelector';
import ProviderSelector from './ProviderSelector';

export type ChatSettingsControlsProps = {
  class?: string;
  onApplyPreset: (preset: TChatPreset) => void;
  onIncludeDateTimeChange?: (checked: boolean) => void;
  onModelChange?: (model: TModel) => void;
  onProviderChange?: (provider: TProvider) => void;
  onReasoningChange?: (reasoning: TChatSettings['reasoning']) => void;
  onSystemPromptChange?: (systemPrompt: string) => void;
  settings: TChatSettings;
};

export function ChatSettingsControls(props: ChatSettingsControlsProps) {
  const providers = useQuery(() => queries.providers.all());
  const selectedProvider = useQuery(() => queries.providers.byId(props.settings.providerId));

  const adapter = createMemo(() => {
    const token =
      selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data.token : undefined;
    if (!token) return null;
    const url =
      selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data!.baseUrl : null;
    if (!url) return null;
    return new OpenAIAdapter(url, token);
  });

  const mcpClients = () => MCPManager.getAllClients();

  return (
    <div class={cn('flex flex-col gap-6', props.class)}>
      <div class="flex flex-col gap-2">
        <Label class="text-muted-foreground text-xs flex gap-1 items-center">
          <span class="icon-[heroicons--cog-8-tooth-16-solid]" />
          <span>Provider &amp; Model</span>
        </Label>
        <ProviderSelector
          onChange={(provider) => {
            props.onProviderChange?.(provider);
          }}
          providers={providers.isSuccess ? providers.data : []}
          selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
        />
        <ModelSelector
          adapter={adapter()}
          onChange={(model) => {
            props.onModelChange?.(model);
          }}
          selectedModelId={props.settings.modelId}
          selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
        />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-muted-foreground text-xs flex gap-1 items-center">
          <span class="icon-[fluent--brain-20-filled]" />
          <span>Reasoning</span>
        </Label>
        <Select
          itemComponent={(itemProps) => (
            <SelectItem item={itemProps.item}>
              {REASONING_VALUE_TO_LABEL_MAP[itemProps.item.rawValue]}
            </SelectItem>
          )}
          onChange={(value) => {
            if (value) props.onReasoningChange?.(value);
          }}
          options={['none', 'minimal', 'low', 'medium', 'high', 'xhigh']}
          value={props.settings.reasoning}
        >
          <SelectTrigger>
            <SelectValue<TChatSettings['reasoning']>>
              {(state) => REASONING_VALUE_TO_LABEL_MAP[state.selectedOption()]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
      </div>
      <Show when={mcpClients().length > 0}>
        <div class="flex flex-col gap-1.5">
          <Label class="text-muted-foreground text-xs flex gap-1 items-center">
            <span class="icon-[heroicons--server-stack-16-solid]" />
            <span>MCP Clients</span>
          </Label>
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
        <TextFieldLabel class="text-muted-foreground text-xs flex gap-1 items-center">
          <span class="icon-[heroicons--chat-bubble-bottom-center-text-16-solid]" />
          <span>System Prompt</span>
        </TextFieldLabel>
        <TextFieldTextArea
          onInput={(e) => props.onSystemPromptChange?.(e.currentTarget.value)}
          placeholder="You are a helpful AI assistant..."
          rows={4}
          value={props.settings.systemPrompt}
        />
      </TextField>
      <SwitchPrimitive
        checked={props.settings.includeDateTimeInSystemPrompt}
        class="flex items-center space-x-2"
        id="includeDateTimeInSystemPrompt"
        onChange={(checked) => props.onIncludeDateTimeChange?.(checked)}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel>Include current date &amp; time in system prompt</SwitchLabel>
      </SwitchPrimitive>
      <PresetsSection
        onApplyPreset={props.onApplyPreset}
        settings={{
          includeDateTimeInSystemPrompt: props.settings.includeDateTimeInSystemPrompt,
          modelId: props.settings.modelId,
          providerId: props.settings.providerId,
          reasoning: props.settings.reasoning,
          systemPrompt: props.settings.systemPrompt
        }}
      />
    </div>
  );
}

export function PresetsSection(props: {
  onApplyPreset: (preset: TChatPreset) => void;
  settings: TChatSettings;
}) {
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = createSignal(false);
  const [saveValue, setSaveValue] = createSignal('');

  const presets = useQuery(() => queries.chatPresets.all());

  const handleSavePreset = async (name: string) => {
    await createPreset(name, props.settings);
    await queryClient.invalidateQueries({ queryKey: ['db', 'chatPresets', 'all'] });
    setSaveDialogOpen(false);
    setSaveValue('');
  };

  return (
    <div class="space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground text-xs flex gap-1 items-center">
          <span class="icon-[heroicons--bookmark-16-solid]" />
          <span>Presets</span>
        </span>
        <Button onClick={() => setSaveDialogOpen(true)} size="sm" variant="outline">
          <span class="icon-[heroicons--document-plus-16-solid]" />
          <span>Save As Preset</span>
        </Button>
      </div>
      <Show
        fallback={<div class="text-sm text-muted-foreground">Loading presets...</div>}
        when={presets.isSuccess && presets.data}
      >
        <Show
          fallback={<div class="text-sm text-muted-foreground">No presets saved yet.</div>}
          when={presets.data!.length > 0}
        >
          <PresetSelector
            onChange={(preset) => props.onApplyPreset(preset)}
            presets={presets.data!}
          />
        </Show>
      </Show>

      <Dialog onOpenChange={setSaveDialogOpen} open={saveDialogOpen()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Preset</DialogTitle>
          </DialogHeader>
          <div class="py-4">
            <TextField>
              <TextFieldLabel>Preset Name</TextFieldLabel>
              <TextFieldInput
                onInput={(e) => setSaveValue(e.currentTarget.value)}
                placeholder="My Custom Preset"
                value={saveValue()}
              />
            </TextField>
          </div>
          <DialogFooter>
            <Button
              disabled={saveValue().trim() === ''}
              onClick={() => handleSavePreset(saveValue())}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ChatSettingsControls;
