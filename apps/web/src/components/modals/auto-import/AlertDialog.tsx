import { createSignal } from 'solid-js';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';

export type TAlertDialogOptions = {
  readonly buttonText?: string;
  readonly description?: string;
  readonly title: string;
  readonly variant?: 'default' | 'destructive';
};

const [options, setOptions] = createSignal<null | TAlertDialogOptions>(null);
let resolvePromise: (() => void) | null = null;
const [open, setOpen] = createSignal(false);

export function AlertDialog() {
  return (
    <Dialog
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setOptions(null);
        }
      }}
      open={open()}
    >
      <DialogContent>
        <form
          method="dialog"
          onSubmit={() => {
            setOpen(false);
            resolvePromise?.();
            setOptions(null);
          }}
        >
          <DialogHeader>
            <DialogTitle>{options()?.title}</DialogTitle>
            {options()?.description && (
              <DialogDescription>{options()?.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter>
            <Button type="submit" variant={options()?.variant || 'default'}>
              {options()?.buttonText || 'OK'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function useAlertDialog() {
  return {
    alert: (opts: TAlertDialogOptions) => {
      return new Promise<void>((resolve) => {
        resolvePromise = resolve;
        setOptions(opts);
        setOpen(true);
      });
    }
  };
}

export default AlertDialog;
