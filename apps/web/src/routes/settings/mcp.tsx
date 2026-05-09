import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';

import { setAddMCPModalOpen } from '~/components/modals/auto-import/AddMCPModal';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { setEditMCPModalOpen } from '~/components/modals/auto-import/EditMCPModal';
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
import type { TMCP } from '~/db/app-schema';

export const Route = createFileRoute('/settings/mcp')({
  component: SettingsMCPComponent,
  loader: async () => {
    return queryClient.ensureQueryData(queries.mcps.all());
  }
});

export function MCPCardDropdownMenu(props: { mcp: TMCP; onDelete: (id: string) => void }) {
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
              title: `Delete MCP "${props.mcp.name}"`,
              description: `Are you sure you want to delete "${props.mcp.name}" MCP server? This action cannot be undone.`,
              confirmText: 'Delete',
              variant: 'destructive',
              onConfirm: () => props.onDelete(props.mcp.id)
            });
          }}
        >
          <span>Delete</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MCPCard(props: { mcp: TMCP; onDelete: (id: string) => void }) {
  return (
    <Card class="flex flex-col">
      <CardHeader>
        <div class="flex items-baseline gap-4">
          <CardTitle class="text-lg truncate" title={props.mcp.name}>
            {props.mcp.name}
          </CardTitle>
          <span class="grow" />
          <MCPCardDropdownMenu mcp={props.mcp} onDelete={props.onDelete} />
          <Button onClick={() => setEditMCPModalOpen(props.mcp.id)} size="icon" variant="secondary">
            <span class="icon-[heroicons--pencil-square-16-solid]"></span>
            <span class="sr-only">Edit MCP</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent class="grow flex flex-col gap-2">
        <div class="flex gap-2 items-center text-sm text-muted-foreground">
          <span class="shrink-0 icon-[heroicons--link-16-solid]"></span>
          <span class="wrap-anywhere">{props.mcp.url}</span>
        </div>
        <span class="grow" />
      </CardContent>
    </Card>
  );
}

function SettingsMCPComponent() {
  const mcps = useQuery(queries.mcps.all);
  const confirmDialog = useConfirmDialog();

  async function deleteMCP(id: string) {
    const yes = await confirmDialog.confirm({
      title: 'Delete MCP',
      description: 'Are you sure you want to delete this mcp?'
    });
    if (!yes) return;
    await logger.dispatch({
      type: 'deleteMcp',
      data: { id }
    });
  }

  return (
    <div class="grid grid-rows-[auto_1fr] gap-8">
      <Show
        fallback={
          <div class="flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
            <span class="icon-[heroicons--cube] text-muted-foreground text-4xl" />
            <p class="text-muted-foreground">No MCP servers configured</p>
            <Button onClick={() => setAddMCPModalOpen(true)}>Add MCP</Button>
          </div>
        }
        when={mcps.data && mcps.data.length > 0}
      >
        <div class="flex justify-end items-center">
          <Button onClick={() => setAddMCPModalOpen(true)}>Add MCP</Button>
        </div>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 self-start">
          <For each={mcps.data}>{(mcp) => <MCPCard mcp={mcp} onDelete={deleteMCP} />}</For>
        </div>
      </Show>
    </div>
  );
}

