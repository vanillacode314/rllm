import { createSignal, onCleanup, Show } from 'solid-js';

import { Button } from '~/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '~/components/ui/dialog';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';

export type TPromptDialogOptions = {
  readonly cancelText?: string;
  readonly confirmText?: string;
  readonly defaultValue?: string;
  readonly description?: string;
  readonly inputType?: 'password' | 'text';
  readonly label?: string;
  readonly title: string;
};

const [options, setOptions] = createSignal<null | TPromptDialogOptions>(null);
const [inputValue, setInputValue] = createSignal('');
let resolvePromise: ((value: null | string) => void) | null = null;
const [open, setOpen] = createSignal(false);

export function PromptDialog() {
  onCleanup(() => setOpen(false));
  return (
    <Dialog
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          setOptions(null);
          setInputValue('');
        }
      }}
      open={open()}
    >
      <DialogContent>
        <form
          class="contents"
          method="dialog"
          onSubmit={() => {
            setOpen(false);
            resolvePromise?.(inputValue());
            setOptions(null);
            setInputValue('');
          }}
        >
          <DialogHeader>
            <DialogTitle>{options()?.title}</DialogTitle>
            {options()?.description && (
              <DialogDescription>{options()?.description}</DialogDescription>
            )}
          </DialogHeader>

          <TextField>
            <Show when={options()?.label}>
              <TextFieldLabel>{options()!.label}</TextFieldLabel>
            </Show>
            <TextFieldInput
              onInput={(e) => setInputValue(e.currentTarget.value)}
              type={options()?.inputType || 'text'}
              value={inputValue()}
            />
          </TextField>
          <DialogFooter>
            <Button
              onClick={() => {
                setOpen(false);
                resolvePromise?.(null);
                setOptions(null);
                setInputValue('');
              }}
              type="button"
              variant="secondary"
            >
              {options()?.cancelText || 'Cancel'}
            </Button>
            <Button type="submit">{options()?.confirmText || 'Confirm'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function usePromptDialog() {
  return {
    prompt: (opts: TPromptDialogOptions) => {
      return new Promise<null | string>((resolve) => {
        resolvePromise = resolve;
        setOptions(opts);
        setInputValue(opts.defaultValue || '');
        setOpen(true);
      });
    }
  };
}

export default PromptDialog;
