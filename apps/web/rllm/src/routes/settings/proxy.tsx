import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { createMemo, For, from, Show } from 'solid-js';
import { Badge } from 'ui/badge';
import { Button } from 'ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from 'ui/dropdown-menu';

import { Draggable, DragHandle } from '~/components/Draggable';
import { DropTarget } from '~/components/DropTarget';
import { setAddProxyModalOpen } from '~/components/modals/auto-import/AddProxyModal';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { setProxyUrlToEdit } from '~/components/modals/auto-import/EditProxyModal';
import { ProxyStatusBadge } from '~/components/ProxyStatusBadge';
import { TransitionSlide } from '~/components/transitions/TransitionSlide';
import { db } from '~/db/client';
import { ProxyManager, type TProxyHealthStatus } from '~/lib/proxy';
import { queries } from '~/queries';
import { moveInPlace } from '~/utils/array';
import { produce } from '~/utils/immer';
import { queryClient } from '~/utils/query-client';
import { createDerivedWritableStore } from '~/utils/stores';
import { cn } from '~/utils/tailwind';

export const Route = createFileRoute('/settings/proxy')({
  component: SettingsProxyComponent,
  loader: async () => {
    await queryClient.ensureQueryData(queries.userMetadata.corsProxyUrls());
  }
});

type TProxyEntry = { id: string; url: string };

function ProxyItem(props: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  class?: string;
  entry: TProxyEntry;
  isActive: boolean;
  onDelete: (url: string) => void;
  onEdit: (url: string) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
}) {
  const confirmDialog = useConfirmDialog();

  return (
    <div
      class={cn('grid items-center border-2 overflow-hidden rounded-lg backdrop-none', props.class)}
      style={{ 'grid-template-columns': 'auto 1fr auto auto auto auto' }}
    >
      <DragHandle>
        <div aria-hidden="true" class="cursor-grab size-10 grid place-content-center">
          <span class="icon-[heroicons--bars-3]" />
        </div>
      </DragHandle>
      <span class="overflow-x-auto whitespace-nowrap text-sm">{props.entry.url}</span>
      <Show when={props.isActive}>
        <Badge class="ml-2 shrink-0" round variant="success">
          In use
        </Badge>
      </Show>
      <Show when={props.canMoveUp}>
        <Button onClick={props.onMoveUp} size="icon" variant="ghost">
          <span class="icon-[heroicons--arrow-up]" />
          <span class="sr-only">Move up</span>
        </Button>
      </Show>
      <Show when={props.canMoveDown}>
        <Button onClick={props.onMoveDown} size="icon" variant="ghost">
          <span class="icon-[heroicons--arrow-down]" />
          <span class="sr-only">Move down</span>
        </Button>
      </Show>
      <DropdownMenu>
        <DropdownMenuTrigger as={Button<'button'>} size="icon" variant="ghost">
          <span class="icon-[heroicons--ellipsis-vertical-16-solid]" />
          <span class="sr-only">Proxy options</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="w-48">
          <DropdownMenuItem onSelect={() => props.onEdit(props.entry.url)}>
            <span>Edit</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              confirmDialog.confirm({
                confirmText: 'Delete',
                description: `Are you sure you want to delete "${props.entry.url}"? This action cannot be undone.`,
                onConfirm: () => props.onDelete(props.entry.url),
                title: 'Delete proxy',
                variant: 'destructive'
              })
            }
          >
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SettingsProxyComponent() {
  const proxyUrl = useQuery(queries.userMetadata.corsProxyUrls);
  const dbEntries = createMemo(() =>
    proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.map((url) => ({ id: url, url })) : []
  );
  const [entries, setEntries] = createDerivedWritableStore<TProxyEntry[]>(() => [...dbEntries()], {
    key: 'id'
  });
  const proxyStatus = from<TProxyHealthStatus>(
    (set) => ProxyManager.subscribe((status) => set(status)),
    'unset'
  );
  const activeProxyUrl = from<string>((set) =>
    ProxyManager.subscribe(() => set(ProxyManager.getActiveProxyUrl() ?? undefined))
  );

  function onDrag(from: number, to: number) {
    if (from === to) return;
    setEntries((entries) => moveInPlace(entries, from, to));
  }

  async function onDrop(from: number, to: number) {
    if (from === to) return;
    const next = produce(dbEntries(), (draft) => moveInPlace(draft, from, to)).map(
      (entry) => entry.url
    );
    await db.userMetadata.setCorsProxyUrls(next);
    await ProxyManager.updateProxyUrls(next);
  }

  function moveEntry(from: number, to: number) {
    if (to < 0 || to >= entries.length) return;
    onDrag(from, to);
    void onDrop(from, to);
  }

  async function handleDelete(url: string) {
    const index = entries.findIndex((entry) => entry.url === url);
    if (index === -1) return;
    const next = produce(entries, (draft) => {
      draft.splice(index, 1);
    }).map((entry) => entry.url);
    await db.userMetadata.setCorsProxyUrls(next);
    await ProxyManager.updateProxyUrls(next);
  }

  function handleEdit(url: string) {
    setProxyUrlToEdit(url);
  }

  return (
    <div>
      <Card class="overflow-hidden">
        <CardHeader>
          <div class="flex items-center justify-between gap-2">
            <CardTitle>CORS Proxy</CardTitle>
            <ProxyStatusBadge status={proxyStatus()} />
          </div>
          <CardDescription>
            Set this if you are using providers or mcp servers that don't set cors headers correctly
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <Show
            fallback={<span class="text-sm text-muted-foreground">No proxies configured.</span>}
            when={entries.length > 0}
          >
            <div class="flex flex-col">
              <TransitionSlide>
                <For each={entries}>
                  {(entry, index) => (
                    <DropTarget
                      canDrop={({ element, source }) =>
                        (element as HTMLElement).dataset.isTransitioning !== 'true' &&
                        source.data.id !== entry.id
                      }
                      onDragEnter={({ source }) => {
                        const from = entries.findIndex((entry) => entry.id === source.data.id);
                        onDrag(from, index());
                      }}
                    >
                      <Draggable
                        data={entry}
                        onDrop={({ source }) => {
                          const from = dbEntries().findIndex(
                            (entry) => entry.id === source.data.id
                          );
                          void onDrop(from, index());
                        }}
                      >
                        <ProxyItem
                          canMoveDown={index() < entries.length - 1}
                          canMoveUp={index() > 0}
                          class="mb-2"
                          entry={entry}
                          isActive={activeProxyUrl() === entry.url}
                          onDelete={handleDelete}
                          onEdit={handleEdit}
                          onMoveDown={() => moveEntry(index(), index() + 1)}
                          onMoveUp={() => moveEntry(index(), index() - 1)}
                        />
                      </Draggable>
                    </DropTarget>
                  )}
                </For>
              </TransitionSlide>
              <Show when={entries.length > 0}>
                <div class="-mt-2" />
              </Show>
            </div>
          </Show>
          <Button class="self-start" onClick={() => setAddProxyModalOpen(true)} variant="secondary">
            <span class="icon-[heroicons--plus]" />
            <span>Add proxy</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
