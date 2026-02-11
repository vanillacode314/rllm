import { createWritableMemo } from '@solid-primitives/memo';
import { useQuery, useQueryClient } from '@tanstack/solid-query';
import { Link, useLocation } from '@tanstack/solid-router';
import { createMemo, createSignal, Show } from 'solid-js';

import { REASONING_VALUE_TO_LABEL_MAP } from '~/constants/chat-settings';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { createPreset, type TChatPreset } from '~/lib/chat/presets';
import { type TChatSettings, updateChatSettings } from '~/lib/chat/settings';
import { ProxyManager } from '~/lib/proxy';
import { queries } from '~/queries';
import { chatSettings } from '~/routes/chat/-state';
import { isMobile } from '~/signals';

import ModelSelector from './ModelSelector';
import ProviderSelector from './ProviderSelector';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from './ui/drawer';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from './ui/switch';
import { TextField, TextFieldInput, TextFieldLabel, TextFieldTextArea } from './ui/text-field';

const [chatSettingsDrawerOpen, setChatSettingsDrawerOpen] = createSignal(false);

function PresetsSection(props: {
  onApplyPreset: (settings: TChatSettings) => void;
  settings: TChatSettings;
}) {
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = createSignal(false);
  const [saveValue, setSaveValue] = createSignal('');

  const presets = useQuery(() => queries.chatPresets.all());
  const defaultPresetId = useQuery(() => queries.userMetadata.byId('default-chat-settings-preset'));

  const handleSavePreset = async (name: string) => {
    await createPreset(name, props.settings);
    await queryClient.invalidateQueries({ queryKey: ['db', 'chatPresets', 'all'] });
    setSaveDialogOpen(false);
    setSaveValue('');
  };

  return (
    <div class="space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">Presets</span>
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
          <Select<TChatPreset>
            itemComponent={(itemProps) => (
              <SelectItem item={itemProps.item}>
                {itemProps.item.rawValue.name}
                {defaultPresetId.data === itemProps.item.key && (
                  <span class="ml-2 text-xs text-muted-foreground">(Default)</span>
                )}
              </SelectItem>
            )}
            onChange={(preset) => {
              if (preset) props.onApplyPreset(preset.settings);
            }}
            options={presets.data!}
            optionTextValue={(preset) => preset.name}
            optionValue={(preset) => preset.id}
            placeholder="Select a preset..."
            value={undefined}
          >
            <SelectTrigger class="w-full">
              <SelectValue<TChatPreset>>
                {(state) => state.selectedOption()?.name ?? 'Select a preset...'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent />
          </Select>
        </Show>
      </Show>

      <Show when={presets.data && presets.data.length > 0}>
        <div class="text-xs text-muted-foreground">
          <Link
            class="underline hover:text-primary"
            onClick={() => setChatSettingsDrawerOpen(false)}
            to="/presets"
          >
            Manage presets
          </Link>
        </div>
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

function TheChatSettingsDrawer() {
  const location = useLocation();
  const selectedProviderId = () =>
    chatSettings().mapOr('Invalid Settings', (settings) => settings.providerId);
  const selectedModelId = () =>
    chatSettings().mapOr('Invalid Settings', (settings) => settings.modelId);
  const currentSystemPrompt = () => chatSettings().mapOr('', (settings) => settings.systemPrompt);
  const includeDateTimeInSystemPrompt = () =>
    chatSettings().mapOr(true, (settings) => settings.includeDateTimeInSystemPrompt);
  const currentReasoning = () => chatSettings().mapOr('medium', (settings) => settings.reasoning);

  const [localSystemPrompt, setLocalSystemPrompt] = createWritableMemo(() => currentSystemPrompt());
  const [localIncludeDateTimeInSystemPrompt, setLocalIncludeDateTimeInSystemPrompt] =
    createWritableMemo(() => includeDateTimeInSystemPrompt());
  const [localReasoning, setLocalReasoning] = createWritableMemo(() => currentReasoning());
  const hasUnsavedChanges = createMemo(
    () =>
      localSystemPrompt() !== currentSystemPrompt() ||
      localReasoning() !== currentReasoning() ||
      localIncludeDateTimeInSystemPrompt() !== includeDateTimeInSystemPrompt()
  );
  const providers = useQuery(() => queries.providers.all());
  const selectedProvider = useQuery(() => queries.providers.byId(selectedProviderId()));

  const adapter = createMemo(() => {
    const token =
      selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data.token : undefined;
    if (!token) return null;
    const url =
      selectedProvider.isSuccess && selectedProvider.data ? selectedProvider.data!.baseUrl : null;
    if (!url) return null;
    return new OpenAIAdapter(url, token);
  });

  const currentSettings = () => ({
    modelId: selectedModelId(),
    providerId: selectedProviderId(),
    systemPrompt: localSystemPrompt(),
    includeDateTimeInSystemPrompt: localIncludeDateTimeInSystemPrompt(),
    reasoning: localReasoning()
  });

  const handleApplyPreset = (settings: TChatSettings) => {
    setLocalSystemPrompt(settings.systemPrompt);
    setLocalIncludeDateTimeInSystemPrompt(settings.includeDateTimeInSystemPrompt);
    setLocalReasoning(settings.reasoning);
    updateChatSettings(settings, location());
  };

  return (
    <Drawer
      closeOnOutsidePointer={false}
      initialFocusEl={document.body}
      onOpenChange={setChatSettingsDrawerOpen}
      open={chatSettingsDrawerOpen()}
      side={isMobile() ? 'top' : 'right'}
    >
      <DrawerContent class="sm:max-w-96 sm:ml-auto sm:h-full top-0 bottom-auto rounded-t-none max-sm:rounded-b-[10px] after:bottom-full after:top-0 after:h-0 mt-0 sm:rounded-l-[10px]">
        <div class="mx-auto w-full max-xs:max-w-sm h-full flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Chat Settings</DrawerTitle>
            <DrawerDescription>Set your chat preferences here.</DrawerDescription>
          </DrawerHeader>
          <div class="p-4 pb-0 grow overflow-y-auto">
            <div class="flex flex-col gap-6">
              <div class="flex flex-col gap-2">
                <Label>Provider &amp; Model</Label>
                <ProviderSelector
                  onChange={async (provider) => {
                    updateChatSettings(
                      {
                        providerId: provider.id,
                        modelId: provider.defaultModelIds[0]
                      },
                      location()
                    );
                  }}
                  providers={providers.isSuccess ? providers.data : []}
                  selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
                />
                <ModelSelector
                  adapter={adapter()}
                  onChange={async (model) => {
                    updateChatSettings(
                      {
                        modelId: model.id
                      },
                      location()
                    );
                  }}
                  selectedModelId={selectedModelId()}
                  selectedProvider={selectedProvider.isSuccess ? selectedProvider.data : null}
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label>Reasoning Effort</Label>
                <Select
                  itemComponent={(props) => (
                    <SelectItem item={props.item}>
                      {REASONING_VALUE_TO_LABEL_MAP[props.item.rawValue]}
                    </SelectItem>
                  )}
                  onChange={(value) => value && setLocalReasoning(value)}
                  options={['none', 'minimal', 'low', 'medium', 'high', 'xhigh']}
                  value={localReasoning()}
                >
                  <SelectTrigger>
                    <SelectValue<TChatSettings['reasoning']>>
                      {(state) => REASONING_VALUE_TO_LABEL_MAP[state.selectedOption()]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>
              <TextField class="flex flex-col gap-1.5">
                <TextFieldLabel>System Prompt</TextFieldLabel>
                <TextFieldTextArea
                  onInput={(e) => setLocalSystemPrompt(e.currentTarget.value)}
                  placeholder="You are a helpful AI assistant..."
                  rows={4}
                  value={localSystemPrompt()}
                />
              </TextField>
              <Switch
                checked={localIncludeDateTimeInSystemPrompt()}
                class="flex items-center space-x-2"
                id="includeDateTimeInSystemPrompt"
                onChange={(checked) => setLocalIncludeDateTimeInSystemPrompt(checked)}
              >
                <SwitchControl>
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel>Include current date/time in system prompt</SwitchLabel>
              </Switch>
            </div>
          </div>
          <DrawerFooter>
            <PresetsSection onApplyPreset={handleApplyPreset} settings={currentSettings()} />
            <Button
              disabled={!hasUnsavedChanges()}
              onClick={() => {
                updateChatSettings(
                  {
                    systemPrompt: localSystemPrompt(),
                    reasoning: localReasoning(),
                    includeDateTimeInSystemPrompt: localIncludeDateTimeInSystemPrompt()
                  },
                  location()
                );
              }}
            >
              {hasUnsavedChanges() ? 'Save Changes' : 'Saved'}
            </Button>
            <DrawerClose as={Button<'button'>} variant="outline">
              <span class="icon-[heroicons--x-mark-16-solid]" />
              <span>Close</span>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
export { chatSettingsDrawerOpen, setChatSettingsDrawerOpen };
export default TheChatSettingsDrawer;
