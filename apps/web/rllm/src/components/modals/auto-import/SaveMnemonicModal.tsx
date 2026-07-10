import { ethers } from 'ethers';
import { createComputed, createRenderEffect, createSignal, For, untrack } from 'solid-js';
import { Button } from 'ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'ui/dialog';

import { useAlertDialog } from './AlertDialog';

const [mnemonic, setMnemonic] = createSignal<null | string>(null);
const open = () => mnemonic() !== null;
const setOpen = (mnemonic: false | null | string) => {
  if (!mnemonic) {
    setMnemonic(null);
    return;
  }
  if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic');
  }
  setMnemonic(mnemonic);
};

export function SaveMnemonicModal() {
  const alertDialog = useAlertDialog();

  if (import.meta.env.VITE_MODE === 'android') {
    createComputed(() => {
      const $open = open();
      if (!$open) return;
      // oxlint-disable-next-line solid/reactivity
      untrack(async () => {
        if (!mnemonic()) return;
        const { PasswordAutofill } = await import('@capawesome/capacitor-password-autofill');
        await PasswordAutofill.savePassword({
          domain: 'llm.raqueeb.com',
          password: mnemonic()!,
          username: 'passphrase'
        });
      });
    });
  }

  return (
    <Dialog
      modal
      onOpenChange={(value) => {
        if (!value) setOpen(false);
      }}
      open={open()}
    >
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Passphrase</DialogTitle>
          <DialogDescription>
            Save or write this passphrase in a secure place (like a password manager, a paper note
            in a secure place, etc...). If you lose it, you will lose access to your account. Anyone
            with this passphrase can access your account.
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid grid-cols-2 lg:grid-cols-4 items-center gap-4">
            <For each={mnemonic()?.split(' ')}>
              {(word, index) => (
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium">{index() + 1}.</span>
                  <span class="text-sm">{word}</span>
                </div>
              )}
            </For>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!mnemonic()) {
                throw new Error('No mnemonic to copy');
              }
              navigator.clipboard.writeText(mnemonic()!);
              void alertDialog.alert({ description: 'Copied to clipboard', title: 'Copied' });
            }}
            variant="secondary"
          >
            <span>Copy</span>
            <span class="icon-[heroicons--clipboard]" />
          </Button>
          <Button onClick={() => setOpen(false)} type="button">
            <span>Done</span>
            <span class="icon-[heroicons--check]" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveMnemonicModal;

export { open as saveMnemonicModalOpen, setOpen as setSaveMnemonicModalOpen };
