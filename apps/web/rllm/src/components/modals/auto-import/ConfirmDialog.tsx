import { createSignal, onCleanup } from 'solid-js';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';

export type TConfirmDialogOptions = {
  readonly cancelText?: string;
  readonly confirmText?: string;
  readonly description: string;
  readonly onCancel?: () => void;
  readonly onConfirm?: () => Promise<void> | void;
  readonly title: string;
  readonly variant?: 'default' | 'destructive';
};

const [options, setOptions] = createSignal<null | TConfirmDialogOptions>(null);
let resolvePromise: ((value: boolean) => void) | null = null;
const [open, setOpen] = createSignal(false);

export function ConfirmDialog() {
  onCleanup(() => setOpen(false));

  return (
    <Dialog onOpenChange={setOpen} open={open()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{options()?.title}</DialogTitle>
          <DialogDescription>{options()?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            onClick={() => {
              setOpen(false);
              options()?.onCancel?.();
              resolvePromise?.(false);
            }}
            variant="secondary"
          >
            {options()?.cancelText || 'Cancel'}
          </Button>
          <Button
            onClick={async () => {
              setOpen(false);
              await options()?.onConfirm?.();
              resolvePromise?.(true);
            }}
            variant={options()?.variant || 'default'}
          >
            {options()?.confirmText || 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirmDialog() {
  return {
    confirm: (opts: TConfirmDialogOptions) => {
      return new Promise<boolean>((resolve) => {
        resolvePromise = resolve;
        setOptions(opts);
        setOpen(true);
      });
    }
  };
}

export default ConfirmDialog;
