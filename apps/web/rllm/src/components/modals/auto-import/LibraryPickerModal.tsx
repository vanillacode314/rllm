import { ReactiveSet } from '@solid-primitives/set';
import { useQuery } from '@tanstack/solid-query';
import { createSignal, For, onCleanup, Show } from 'solid-js';
import { Button } from 'ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'ui/dialog';

import type { TAttachment } from '~/types/chat';

import { queries } from '~/queries';
import { chatState } from '~/routes/(chat)/-state';

const [open, setOpen] = createSignal(false);
const selectedIds = new ReactiveSet();
let resolvePromise: ((attachments: null | TAttachment[]) => void) | null = null;

export function LibraryPickerModal() {
  onCleanup(() => setOpen(false));
  const documents = useQuery(() => queries.documents.all());

  function close(result: null | TAttachment[]) {
    const resolve = resolvePromise;
    resolvePromise = null;
    setOpen(false);
    resolve?.(result);
  }

  function confirm() {
    const libraryAttachments = (documents.data ?? [])
      .filter((document) => selectedIds.has(document.id))
      .map(
        (document): TAttachment => ({
          description: document.name,
          id: document.id,
          progress: 1,
          transient: false
        })
      );
    close(libraryAttachments);
  }

  return (
    <Dialog
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          const resolve = resolvePromise;
          resolvePromise = null;
          resolve?.(null);
        }
      }}
      open={open()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach Documents</DialogTitle>
          <DialogDescription>
            Select documents from your library or the current chat to attach.
          </DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-2 overflow-y-auto max-h-96">
          <Show
            fallback={
              <p class="text-sm text-muted-foreground">No documents in your library yet.</p>
            }
            when={documents.data && documents.data.length > 0}
          >
            <For each={documents.data}>
              {(document) => (
                <label class="flex gap-2 items-center p-2 rounded-lg hover:bg-primary/10">
                  <input
                    checked={selectedIds.has(document.id)}
                    class="accent-primary"
                    onChange={() => toggleSelection(document.id)}
                    type="checkbox"
                  />
                  <span class="icon-[heroicons--book-open]" />
                  <span class="text-sm truncate">{document.name}</span>
                </label>
              )}
            </For>
          </Show>
        </div>
        <DialogFooter>
          <Button onClick={() => close(null)} type="button" variant="secondary">
            Cancel
          </Button>
          <Button onClick={confirm} type="button">
            Attach
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useLibraryPicker() {
  return {
    pick(): Promise<null | TAttachment[]> {
      return new Promise((resolve) => {
        resolvePromise = resolve;
        selectedIds.clear();
        for (const attachment of chatState.attachments) {
          selectedIds.add(attachment.id);
        }
        setOpen(true);
      });
    }
  };
}

function toggleSelection(id: string) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
}

export default LibraryPickerModal;
