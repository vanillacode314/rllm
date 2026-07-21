import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';
import { Button } from 'ui/button';
import { Card, CardContent, CardHeader, CardTitle } from 'ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'ui/dropdown-menu';

import { AppDrawerFab } from '~/components/AppDrawer';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { setEditPresetModalOpen } from '~/components/modals/auto-import/EditPresetModal';
import { setChatSettingsDrawerOpen } from '~/components/TheChatSettingsDrawer';
import { REASONING_VALUE_TO_LABEL_MAP } from '~/constants/chat-settings';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import {
  deletePreset,
  duplicatePreset,
  setDefaultPresetId,
  type TChatPreset
} from '~/lib/chat/presets';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/presets')({
  component: PresetComponent,
  loader: async () => {
    await Promise.all([
      queryClient.ensureQueryData(queries.providers.all()),
      queryClient.ensureQueryData(queries.chatPresets.all()),
      queryClient.ensureQueryData(queries.userMetadata.byId(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET))
    ]);
  }
});

export function PresetCardDropdownMenu(props: { preset: TChatPreset }) {
  const defaultPresetId = useQuery(() => queries.userMetadata.byId(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET));
  const confirmDialog = useConfirmDialog();
  return (
    <div class="flex-col">
      <DropdownMenu>
        <DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost">
          <span class="icon-[heroicons--ellipsis-vertical-16-solid]" />
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48">
          <Show
            fallback={
              <DropdownMenuItem onSelect={() => setDefaultPresetId('')}>
                <span>Clear Default</span>
              </DropdownMenuItem>
            }
            when={defaultPresetId.data !== props.preset.id}
          >
            <DropdownMenuItem onSelect={() => setDefaultPresetId(props.preset.id)}>
              <span>Set Default</span>
            </DropdownMenuItem>
          </Show>
          <DropdownMenuItem onSelect={() => duplicatePreset(props.preset)}>
            <span>Duplicate</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              confirmDialog.confirm({
                confirmText: 'Delete',
                description: `Are you sure you want to delete "${props.preset.name}" preset? This action cannot be undone.`,
                onConfirm: () => deletePreset(props.preset.id),
                title: `Delete Preset "${props.preset.name}"`,
                variant: 'destructive'
              });
            }}
          >
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function PresetCard(props: { preset: TChatPreset }) {
  const defaultPresetId = useQuery(() => queries.userMetadata.byId(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET));
  const providers = useQuery(() => queries.providers.all());

  function getProviderNameById(id: string) {
    const provider = providers.data?.find((provider) => provider.id === id);
    if (!provider) throw new Error(`Provider with id ${id} not found`);
    return provider.name;
  }

  function simplifyModelId(id: string): string {
    if (!id.includes('/')) return id;
    const index = id.lastIndexOf('/');
    return id.slice(index + 1);
  }

  return (
    <Card class="flex flex-col">
      <CardHeader>
        <div class="flex items-baseline gap-4">
          <CardTitle class="text-lg truncate" title={props.preset.name}>
            {props.preset.name}
          </CardTitle>
          <Show when={defaultPresetId.data === props.preset.id}>
            <span class="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">Default</span>
          </Show>
          <span class="grow" />
          <PresetCardDropdownMenu preset={props.preset} />
          <Button
            onClick={() => setEditPresetModalOpen(props.preset.id)}
            size="icon"
            variant="secondary"
          >
            <span class="icon-[heroicons--pencil-square-16-solid]" />
            <span class="sr-only">Edit Preset</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent class="grow flex flex-col gap-2">
        <Show when={props.preset.settings.systemPrompt}>
          <div class="text-muted-foreground text-xs p-2 bg-muted rounded overflow-y-auto max-h-36 whitespace-pre-wrap">
            {props.preset.settings.systemPrompt}
          </div>
        </Show>
        <span class="grow" />
        <div class="flex flex-col gap-5">
          <span class="text-sm text-muted-foreground">
            <span class="flex gap-2 items-center lowercase">
              <span class="shrink-0 icon-[heroicons--square-3-stack-3d-16-solid]" />
              <span class="flex gap-1 items-center">
                <span>{simplifyModelId(props.preset.settings.modelId)}</span>
                <span class="shrink-0 size-3 icon-[heroicons--arrow-left-16-solid]" />
                <span>{getProviderNameById(props.preset.settings.providerId)}</span>
              </span>
            </span>
            <Show
              when={props.preset.settings.reasoning && props.preset.settings.reasoning !== 'none'}
            >
              <span class="flex gap-2 items-center lowercase">
                <span class="shrink-0 icon-[fluent--brain-20-filled]" />
                {REASONING_VALUE_TO_LABEL_MAP[props.preset.settings.reasoning]}
              </span>
            </Show>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function PresetComponent() {
  const presets = useQuery(() => queries.chatPresets.all());

  return (
    <div class="flex w-full flex-col gap-4 py-4 h-full overflow-hidden">
      <AppDrawerFab />
      <Show
        fallback={<div class="text-muted-foreground">Loading presets...</div>}
        when={presets.isSuccess && presets.data}
      >
        <Show
          fallback={
            <div class="mx-4 h-full flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
              <span class="icon-[heroicons--cube] text-muted-foreground text-4xl" />
              <p class="text-muted-foreground">No presets saved yet</p>
              <Button onClick={() => setChatSettingsDrawerOpen(true)} type="button">
                Create Preset
              </Button>
            </div>
          }
          when={presets.data!.length > 0}
        >
          <div class="flex items-center justify-end px-4">
            <Button onClick={() => setChatSettingsDrawerOpen(true)} type="button" variant="default">
              <span class="icon-[heroicons--plus-16-solid]" />
              <span>Create Preset</span>
            </Button>
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 self-start overflow-y-auto h-full px-4">
            <For each={presets.data}>{(preset) => <PresetCard preset={preset} />}</For>
          </div>
        </Show>
      </Show>
    </div>
  );
}
