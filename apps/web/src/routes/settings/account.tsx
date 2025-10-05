import { createFileRoute } from '@tanstack/solid-router'
import { type } from 'arktype'
import { ethers } from 'ethers'
import { Match, Switch } from 'solid-js'
import { createStore } from 'solid-js/store'
import { toast } from 'solid-sonner'
import { tryBlock } from 'ts-result-option/utils'

import { setSaveMnemonicModalOpen } from '~/components/modals/auto-import/SaveMnemonicModal'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { deleteDatabaseFile } from '~/db/client'
import { account, setAccount } from '~/signals/account'
import { receiveMessages } from '~/utils/messages'
import { optimizeMessages } from '~/utils/storage'
import { getMessages } from '~/utils/sync-server'

export const Route = createFileRoute('/settings/account')({
  component: SettingsAccountComponent,
})

const responseSchema = type({
  nextAfter: 'string | null',
  hasMore: 'boolean',
  pageSize: 'number',
  messages: [{ data: 'string', syncedAt: 'string' }, '[]'],
})

function SettingsAccountComponent() {
  const [status, setStatus] = createStore<{
    loading: boolean
    processed: number
  }>({ loading: false, processed: 0 })

  async function createNewAccount() {
    const wallet = ethers.Wallet.createRandom()
    setSaveMnemonicModalOpen(wallet.mnemonic!.phrase)
    const account = await saveAccount(wallet)
    setAccount(account)
  }

  async function saveAccount(wallet: ethers.HDNodeWallet) {
    const seed = wallet.mnemonic!.entropy
    const salt = new Uint8Array(16)
    const iterations = 650_000

    const encoder = new TextEncoder()
    const derivedKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(seed),
      { name: 'PBKDF2' },
      false,
      ['deriveKey'],
    )
    const aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256',
      },
      derivedKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    )
    const jsonAesKey = await window.crypto.subtle.exportKey('jwk', aesKey)
    return {
      privateKey: wallet.privateKey,
      publicKey: wallet.publicKey,
      aesKey: jsonAesKey,
      id: wallet.address,
    }
  }

  const login = () =>
    tryBlock(
      async function* () {
        const passphrase = prompt(
          'Enter your passphrase (make sure the words are seperated by 1 space)',
        )
        if (!passphrase) {
          alert('Passphrase is required')
          return
        }
        const isValid = ethers.Mnemonic.isValidMnemonic(passphrase)
        if (!isValid) {
          alert('Invalid passphrase')
          return
        }

        const { publicKey, privateKey, id, aesKey } = await saveAccount(
          ethers.Wallet.fromPhrase(passphrase),
        )

        let after: null | string = null
        setStatus('loading', true)
        while (true) {
          const { nextAfter, messages, hasMore } = yield* getMessages(
            id,
            aesKey,
            {
              after,
            },
          )
          await receiveMessages(await optimizeMessages(messages))
          setStatus({ processed: status.processed + messages.length })
          if (!hasMore) break
          after = nextAfter as null | string
        }
        setAccount({ publicKey, privateKey, aesKey, id })
      },
      (e) => new Error('Failed to login', { cause: e }),
    )
      .catch((e) => {
        console.error(e)
        toast.error('Failed to login. If this persists, please contact support')
      })
      .finally(() => {
        setStatus({ loading: false, processed: 0 })
        location.reload()
      })

  async function logout() {
    const yes = confirm(
      'Are you sure you want to logout? This will remove all your data from this device.',
    )
    if (!yes) return
    setAccount(null)
    localStorage.clear()
    await deleteDatabaseFile()
    location.reload()
  }

  return (
    <div class="flex flex-col gap-4">
      <Switch>
        <Match when={status.loading}>
          <Card>
            <CardHeader>
              <CardTitle>Syncing data</CardTitle>
            </CardHeader>
            <CardContent class="grid place-items-center gap-4">
              <span class="icon-[svg-spinners--180-ring-with-bg] text-5xl" />
            </CardContent>
          </Card>
        </Match>

        <Match when={account()}>
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription class="wrap-anywhere">
                ID: {account()!.id}
              </CardDescription>
            </CardHeader>
            {/* <CardContent class="wrap-anywhere">@user</CardContent> */}
            <CardFooter class="flex justify-end">
              <Button class="max-sm:w-full" onClick={() => logout()}>
                <span class="icon-[heroicons--arrow-right-on-rectangle]" />
                <span>Logout</span>
              </Button>
            </CardFooter>
          </Card>
        </Match>
        <Match when={true}>
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription class="prose max-w-none">
                <p>
                  If you would like to sync your data across devices, you can
                  login or create a new account.
                </p>
                <p>
                  All your data is encrypted before it is sent from your device.
                </p>
              </CardDescription>
            </CardHeader>
            <CardContent class="max-sm:flex-col flex gap-4">
              <Button onClick={() => createNewAccount()}>
                <span class="icon-[heroicons--plus]" />
                <span>Create new account</span>
              </Button>
              <Button onClick={() => login()}>
                <span class="icon-[heroicons--arrow-left-on-rectangle]" />
                <span>Login</span>
              </Button>
            </CardContent>
          </Card>
        </Match>
      </Switch>
    </div>
  )
}
