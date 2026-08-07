import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';
import { toast } from 'solid-sonner';
import { Button } from 'ui/button';
import { Card, CardHeader, CardTitle } from 'ui/card';

import type { TDocument } from '~/db/app-schema';

import { AppDrawerFab } from '~/components/AppDrawer';
import { useConfirmDialog } from '~/components/modals/auto-import/ConfirmDialog';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { createTask } from '~/lib/background-task-manager/tasks';
import { deleteDocument } from '~/lib/vector-db/client.platform.common';
import { indexingProgress, type TIndexingProgress } from '~/lib/vector-db/progress';
import { queries } from '~/queries';
import { formatError } from '~/utils/errors';
import { getFile } from '~/utils/files';
import { produce } from '~/utils/immer';

import { setAttachments } from './(chat)/-state';

export const Route = createFileRoute('/documents')({
  component: DocumentsComponent
});

function DocumentCard(props: { document: TDocument }) {
  const confirmDialog = useConfirmDialog();

  function onDelete() {
    confirmDialog.confirm({
      confirmText: 'Delete',
      description: `Are you sure you want to delete "${props.document.name}"? This action cannot be undone.`,
      onConfirm: async () => {
        await deleteDocument(props.document.id);
        setAttachments((attachments) =>
          produce(attachments, (attachments) => {
            const index = attachments.findIndex(
              (attachment) => attachment.id === props.document.id
            );
            attachments.splice(index, 1);
          })
        );
      },
      title: `Delete Document?`,
      variant: 'destructive'
    });
  }

  return (
    <Card class="flex flex-col">
      <CardHeader>
        <div class="flex items-baseline gap-4">
          <CardTitle class="text-lg truncate" title={props.document.name}>
            {props.document.name}
          </CardTitle>
          <span class="grow" />
          <Button onClick={onDelete} size="icon" variant="ghost" class="shrink-0">
            <span class="icon-[heroicons--trash]" />
            <span class="sr-only">Delete Document</span>
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

function DocumentsComponent() {
  const documents = useQuery(() => queries.documents.all());

  async function onAddDocument() {
    const file = await getFile('application/pdf,application/epub+zip');
    if (!file) return;
    try {
      const { promise } = await BackgroundTaskManager.scheduleTask(
        createTask({ arguments: { file }, type: 'indexDocument' }, 'immediate')
      );
      await promise;
      toast.success('Document indexed');
    } catch (error) {
      toast.error(formatError(error as Error));
    }
  }

  return (
    <div class="flex w-full flex-col gap-4 py-4 h-full overflow-hidden">
      <AppDrawerFab />
      <Show
        fallback={<div class="text-muted-foreground">Loading documents...</div>}
        when={documents.isSuccess && documents.data}
      >
        <Show
          fallback={
            <div class="mx-4 h-full flex flex-col items-center justify-center gap-4 p-12 border-2 border-dashed rounded-lg row-start-1 row-end-3">
              <span class="icon-[heroicons--document] text-muted-foreground text-4xl" />
              <p class="text-muted-foreground">No documents yet</p>
              <Button onClick={onAddDocument} type="button">
                Add Document
              </Button>
            </div>
          }
          when={documents.data!.length > 0 || Object.keys(indexingProgress).length > 0}
        >
          <div class="flex items-center justify-end px-4">
            <Button onClick={onAddDocument} type="button" variant="default">
              <span class="icon-[heroicons--plus-16-solid]" />
              <span>Add Document</span>
            </Button>
          </div>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 justify-start items-start overflow-y-auto px-4">
            <Show when={Object.keys(indexingProgress).length > 0}>
              <For each={Object.entries(indexingProgress)}>
                {([, progress]) => <IndexingCard progress={progress} />}
              </For>
            </Show>
            <For each={documents.data}>{(document) => <DocumentCard document={document} />}</For>
          </div>
        </Show>
      </Show>
    </div>
  );
}

function IndexingCard(props: { progress: TIndexingProgress }) {
  return (
    <Card class="flex flex-col">
      <CardHeader>
        <div class="flex items-baseline gap-4">
          <CardTitle class="text-lg truncate" title={props.progress.name}>
            {props.progress.name}
          </CardTitle>
          <span class="grow" />
          <span class="text-xs text-muted-foreground">
            <span class="shrink-0 icon-[svg-spinners--180-ring-with-bg]" />
            {(props.progress.current * 100).toFixed(2)}%
          </span>
        </div>
      </CardHeader>
    </Card>
  );
}
