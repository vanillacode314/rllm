import { createSignal, For } from 'solid-js'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { ethers } from 'ethers'

const [mnemonic, setMnemonic] = createSignal<string | null>(null)
const open = () => mnemonic() !== null
const setOpen = (mnemonic: string | null | false) => {
  if (!mnemonic) {
    setMnemonic(null)
    return
  }
  if (!ethers.Mnemonic.isValidMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic')
  }
  setMnemonic(mnemonic)
}

export function SaveMnemonicModal() {
  return (
    <Dialog
      modal
      onOpenChange={(value) => {
        if (!value) setOpen(false)
      }}
      open={open()}
    >
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Passphrase</DialogTitle>
          <DialogDescription>
            Save this passphrase in a secure place. If you lose it, you will
            lose access to your account. Anyone with this passphrase can access
            your account.
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
            variant="secondary"
            onClick={() => {
              if (!mnemonic()) {
                throw new Error('No mnemonic to copy')
              }
              navigator.clipboard.writeText(mnemonic()!)
              alert('Copied to clipboard')
            }}
          >
            <span>Copy</span>
            <span class="icon-[heroicons--clipboard]" />
          </Button>
          <Button type="button" onClick={() => setOpen(false)}>
            <span>Done</span>
            <span class="icon-[heroicons--check]" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SaveMnemonicModal

export { open as saveMnemonicModalOpen, setOpen as setSaveMnemonicModalOpen }
