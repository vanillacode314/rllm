import { useMutation } from '@tanstack/solid-query'
import { count, gt } from 'drizzle-orm'
import * as schema from '~/db/schema'
import { createFileRoute } from '@tanstack/solid-router'
import { createSignal, onMount, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { toast } from 'solid-sonner'

import { Button } from '~/components/ui/button'
import { db, deleteDatabaseFile, getDatabaseInfo } from '~/db/client'
import { round } from '~/utils/math'
import { createDebouncedMemo } from '~/utils/signals'
import { optimizeStorage as optimizeStorageUtil } from '~/utils/storage'
import { ofetch } from 'ofetch'
import { env } from '~/utils/env'
import { account, setAccount } from '~/signals/account'
import { type } from 'arktype'
import { safeParseJson, tryBlock } from 'ts-result-option/utils'
import { ethers } from 'ethers'
import { getMetadata } from '~/utils/db'
import { encryptDataWithKey } from '~/utils/crypto'

export const Route = createFileRoute('/settings/storage')({
  component: SettingsStorageComponent,
})

function formatBytes(value: number): string {
  if (value === 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0

  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }

  value = round(value, 2)
  return `${value} ${units[i]}`
}

function SettingsStorageComponent() {
  const [size, setSize] = createSignal<null | number>(null)

  onMount(updateSize)

  async function updateSize() {
    const info = await getDatabaseInfo()
    setSize(info.databaseSizeBytes ?? null)
  }

  const optimizeStorage = useMutation(() => ({
    mutationFn: optimizeStorageUtil,
    onSuccess: () => updateSize(),
  }))

  const optimizeStorageIsPending = createDebouncedMemo(
    () => optimizeStorage.isPending,
    false,
    {
      duration: 300,
    },
  )

  const [serverOptimizationStatus, setServerOptimizationStatus] = createStore<{
    processed: number
    total: number
  }>({
    processed: 0,
    total: 0,
  })
  const optimizeServerStorage = useMutation(() => ({
    mutationFn: async () => {
      if (!env.VITE_SYNC_SERVER_BASE_URL) throw new Error('No Sync Server')
      const $account = account()
      if (!$account) throw new Error('No Account')
      const clientId = await getMetadata('clientId')
      if (!clientId) throw new Error('No Client ID')
      await tryBlock(
        async function* () {
          const challenge = await ofetch(
            env.VITE_SYNC_SERVER_BASE_URL + '/api/v1/auth/requestChallenge',
            {
              method: 'GET',
              query: {
                accountId: $account.id,
              },
              responseType: 'text',
            },
          )

          const { nonce } = yield* safeParseJson(challenge, {
            validate: type({
              nonce: 'string',
            }).assert,
          })

          const wallet = new ethers.Wallet($account.privateKey)
          const signature = await wallet.signMessage(nonce)

          const aesKey = await window.crypto.subtle.importKey(
            'jwk',
            $account.aesKey,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt'],
          )

          const response = await ofetch(
            env.VITE_SYNC_SERVER_BASE_URL + '/api/v1/auth/verifyChallenge',
            {
              method: 'POST',
              body: {
                accountId: $account.id,
                nonce,
                signature,
              },
              responseType: 'text',
            },
          )

          const { token } = yield* safeParseJson(response, {
            validate: type({
              token: 'string',
            }).assert,
          })
          const pageSize = 100
          let after: string | null = null
          let serverAfter: string | undefined = undefined
          const [{ count: total }] = await db
            .select({ count: count() })
            .from(schema.messages)
          setServerOptimizationStatus({
            processed: 0,
            total,
          })
          const getMessages = () =>
            db
              .select()
              .from(schema.messages)
              .where(gt(schema.messages.timestamp, after!).if(after))
              .orderBy(schema.messages.timestamp)
              .limit(pageSize + 1)
          let hasMore = true
          let messages = await getMessages()

          while (hasMore) {
            hasMore = messages.length > pageSize
            messages.pop()

            const data = await encryptDataWithKey(
              JSON.stringify(messages),
              aesKey,
            )
            const signature = await wallet.signMessage(data)
            const response = await ofetch(
              env.VITE_SYNC_SERVER_BASE_URL + '/api/v1/messages',
              {
                method: 'PUT',
                body: {
                  accountId: $account.id,
                  clientId,
                  data,
                  signature,
                  after: serverAfter,
                },
                responseType: 'text',
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
            )

            const { nextAfter } = yield* safeParseJson(response, {
              validate: type({
                nextAfter: 'string',
              }).assert,
            })
            serverAfter = nextAfter as string

            setServerOptimizationStatus({
              processed: serverOptimizationStatus.processed + messages.length,
            })
            after = messages.at(-1)!.timestamp
            messages = await getMessages()
          }
        },
        (e) => new Error(`Failed to optimize server storage`, { cause: e }),
      ).unwrap()
    },
    onError: (error) => {
      console.error(error)
    },
  }))

  async function deleteAllData() {
    const yes = confirm(
      'Are you sure? This will remove all your data from this device and log you out.',
    )
    if (!yes) return
    setAccount(null)
    localStorage.clear()
    await deleteDatabaseFile()
    location.reload()
  }

  return (
    <div class="flex flex-col gap-4 items-start">
      <Button
        onClick={() =>
          optimizeStorage.mutate(undefined, {
            onSuccess: () => toast.success('Done'),
            onError: () => toast.error('An Error Occured'),
          })
        }
      >
        <Show when={optimizeStorageIsPending()}>
          <span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
        </Show>
        <Show fallback={<p>Unknown</p>} when={size !== null}>
          <span>{formatBytes(size()!)} In Use</span>
        </Show>
        | <span>Optimize</span>
      </Button>
      <Show when={account()}>
        <Button
          onClick={() => {
            const yes = confirm(
              'This is only useful after local optimization has already been done. Proceed?',
            )
            if (!yes) return
            optimizeServerStorage.mutate(undefined, {
              onSuccess: () => toast.success('Done'),
              onError: () => toast.error('An Error Occured'),
            })
          }}
        >
          <Show when={optimizeServerStorage.isPending}>
            <span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
            <span>
              {serverOptimizationStatus.processed} /{' '}
              {serverOptimizationStatus.total} Messages Synced
            </span>
          </Show>
          <span>Sync Optimizations To Server</span>
        </Button>
      </Show>
      <Button onClick={deleteAllData} variant="destructive" type="button">
        Delete All Data
      </Button>
    </div>
  )
}
