import { createMemo, createSignal } from 'solid-js';
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

export type TDocumentDialogOptions = {
  document: TAttachment & { text: string };
};

const [options, setOptions] = createSignal<null | TDocumentDialogOptions>(null);
let resolvePromise: (() => void) | null = null;
const open = createMemo(() => options() !== null);

export function DocumentDialog() {
  const document = () => options()?.document;
  return (
    <Dialog
      onOpenChange={(value) => {
        if (!value) setOptions(null);
      }}
      open={open()}
    >
      <DialogContent>
        <form
          method="dialog"
          onSubmit={() => {
            resolvePromise?.();
            setOptions(null);
          }}
        >
          <DialogHeader>
            <DialogTitle class="mb-6">{document()?.description}</DialogTitle>
          </DialogHeader>
          <DialogDescription class="whitespace-pre-wrap">{document()?.text}</DialogDescription>
          <DialogFooter>
            <Button type="submit">Close</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useDocumentDialog() {
  return {
    open: (opts: TDocumentDialogOptions) => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve;
        setOptions(opts);
      });
    }
  };
}

export default DocumentDialog;
