import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';

import type { TProvider } from '~/db/app-schema';

import { setAddProviderModalOpen } from '~/components/modals/auto-import/AddProviderModal';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { setEditProviderModalOpen } from '~/components/modals/auto-import/EditProviderModal';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '~/components/ui/dropdown-menu';
import { logger } from '~/db/client';
import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/providers')({
  component: SettingsProviderComponent,
  loader: async () => {
    return queryClient.ensureQueryData(queries.providers.all());
  }
});

export function ProviderCardDropdownMenu(props: {
  onDelete: (id: string) => void;
  provider: TProvider;
}) {
  const confirmDialog = useConfirmDialog();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost">
        <span class="icon-[heroicons--ellipsis-vertical-16-solid]"></span>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-48">
        <DropdownMenuItem
          onSelect={() => {
            confirmDialog.confirm({
              title: `Delete Provider "${props.provider.name}"`,
              description: `Are you sure you want to delete "${props.provider.name}" provider? This action cannot be undone.`,
              confirmText: 'Delete',
              variant: 'destructive',
              onConfirm: () => props.onDelete(props.provider.id)
            });
          }}
        >
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProviderCard(props: { onDelete: (id: string) => void; provider: TProvider }) {
  return (
    <Card class="flex flex-col">
      <CardHeader>
        <div class="flex items-baseline gap-4">
          <CardTitle class="text-lg truncate" title={props.provider.name}>
            {props.provider.name}
          </CardTitle>
          <span class="grow" />
          <ProviderCardDropdownMenu onDelete={props.onDelete} provider={props.provider} />
          <Button
            onClick={() => setEditProviderModalOpen(props.provider.id)}
            size="icon"
            variant="secondary"
          >
            <span class="icon-[heroicons--pencil-square-16-solid]"></span>
            <span class="sr-only">Edit Provider</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent class="grow flex flex-col gap-2">
        <div class="flex gap-2 items-center text-sm text-muted-foreground">
          <span class="shrink-0 icon-[heroicons--link-16-solid]"></span>
          <span class="wrap-anywhere">{props.provider.baseUrl}</span>
        </div>
        <span class="grow" />
      </CardContent>
    </Card>
  );
}

function SettingsProviderComponent() {
  const providers = useQuery(queries.providers.all);
  const confirmDialog = useConfirmDialog();

  async function deleteProvider(id: string) {
    const yes = await confirmDialog.confirm({
      title: 'Delete Provider',
      description: 'Are you sure you want to delete this provider?'
    });
    if (!yes) return;
    await logger.dispatch({
      type: 'deleteProvider',
      data: { id }
    });
  }

  return (
    <div class="grid grid-rows-[auto_1fr] gap-8">
      <Show
        fallback={
          <div class="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
            <span class="icon-[heroicons--cube] text-muted-foreground text-4xl" />
            <p class="text-muted-foreground">No providers configured</p>
            <Button onClick={() => setAddProviderModalOpen(true)}>Add Provider</Button>
          </div>
        }
        when={providers.data && providers.data.length > 0}
      >
        <div class="flex justify-end items-center">
          <Button onClick={() => setAddProviderModalOpen(true)}>Add Provider</Button>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 self-start">
          <For each={providers.data}>
            {(provider) => <ProviderCard onDelete={deleteProvider} provider={provider} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

