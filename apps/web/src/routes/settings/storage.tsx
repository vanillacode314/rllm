import { useMutation } from '@tanstack/solid-query'
import { createFileRoute } from '@tanstack/solid-router'
import { type } from 'arktype'
import { count, gt } from 'drizzle-orm'
import { ethers } from 'ethers'
import { createSignal, Match, onMount, Show, Switch } from 'solid-js'
import { createStore } from 'solid-js/store'
import { toast } from 'solid-sonner'
import { safeParseJson, tryBlock } from 'ts-result-option/utils'

import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { db, deleteDatabaseFile, getDatabaseInfo } from '~/db/client'
import * as schema from '~/db/schema'
import { account, setAccount } from '~/signals/account'
import { encryptDataWithKey } from '~/utils/crypto'
import { getMetadata, setMetadata } from '~/utils/db'
import { round } from '~/utils/math'
import { receiveMessages } from '~/utils/messages'
import { createDebouncedMemo } from '~/utils/signals'
import {
  optimizeMessages,
  optimizeStorage as optimizeStorageUtil,
} from '~/utils/storage'
import { createAuthenticatedSyncServerFetcher } from '~/utils/sync-server'
import { getMessages as getServerMessages } from '~/utils/sync-server'

export const Route = createFileRoute('/settings/storage')({
  component: SettingsStorageComponent,
  async loader() {
    const info = await getDatabaseInfo()
    return { size: info.databaseSizeBytes ?? null }
  },
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
  const data = Route.useLoaderData()
  const [size, setSize] = createSignal<null | number>(data().size)

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
    type: 'fetching' | 'sending'
  }>({
    type: 'fetching',
    processed: 0,
    total: 0,
  })

  const optimizeServerStorage = useMutation(() => ({
    onMutate: async () => {
      await optimizeStorage.mutateAsync()
    },
    mutationFn: () =>
      tryBlock(
        async function* () {
          const fetcher = yield* createAuthenticatedSyncServerFetcher()
          const $account = account()
          if (!$account) throw new Error('No account found')
          const clientId = await getMetadata('clientId')
          if (!clientId) throw new Error('No client ID found')

          setServerOptimizationStatus({
            type: 'fetching',
          })

          {
            let after: null | string = null
            while (true) {
              const { nextAfter, messages, hasMore } = yield* getServerMessages(
                $account.id,
                $account.aesKey,
                { after, clientId },
              )

              await receiveMessages(await optimizeMessages(messages))
              if (!hasMore) break
              after = nextAfter as null | string
            }
          }

          const lastPullAt = await getMetadata('lastPullAt')
          if (!lastPullAt) throw new Error('No last pull time found')
          const lastPushAt = await getMetadata('lastPushAt')
          if (!lastPushAt) throw new Error('No last pull time found')

          const wallet = new ethers.Wallet($account.privateKey)

          const aesKey = await window.crypto.subtle.importKey(
            'jwk',
            $account.aesKey,
            { name: 'AES-GCM' },
            true,
            ['encrypt', 'decrypt'],
          )

          const [{ count: total }] = await db
            .select({ count: count() })
            .from(schema.messages)
          setServerOptimizationStatus({
            type: 'sending',
            processed: 0,
            total,
          })
          await fetcher('/api/v1/messages', {
            method: 'DELETE',
            body: {
              accountId: $account.id,
              before: lastPullAt > lastPushAt ? lastPullAt : lastPushAt,
            },
          })

          const pageSize = 200
          let localAfter: null | string = null
          const getMessages = (after?: string) =>
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
            if (hasMore) {
              messages.pop()
            }

            const data = await encryptDataWithKey(
              JSON.stringify(messages),
              aesKey,
            )
            const signature = await wallet.signMessage(data)
            const text = await fetcher('/api/v1/messages', {
              method: 'POST',
              body: {
                accountId: $account.id,
                clientId,
                data,
                signature,
              },
              responseType: 'text',
            })
            const { timestamp } = yield* safeParseJson(text, {
              validate: type({ timestamp: 'string' }).assert,
            })
            await setMetadata('lastPushAt', timestamp)
            setServerOptimizationStatus({
              processed: serverOptimizationStatus.processed + messages.length,
            })
            localAfter = messages.at(-1)!.timestamp
            messages = await getMessages(localAfter)
          }
        },
        (e) => new Error(`Failed to optimize server storage`, { cause: e }),
      ).unwrap(),
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
    <div class="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Optimize</CardTitle>
          <CardDescription>
            You only really need to do these very rarely like once a year.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p class="text-sm font-bold mb-4">
            {size() ? formatBytes(size()!) : 'Unknown'} currently in use
          </p>
          <div class="flex max-sm:flex-col gap-4">
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
              <span>Optimize Local Storage</span>
            </Button>
            <Show when={account()}>
              <Button
                onClick={() => {
                  const yes = confirm(
                    'This operation can take a while. You only have to do this on 1 of your devices. The app must be online and you must not close it. Are you sure you want to proceed?',
                  )
                  if (!yes) return
                  optimizeServerStorage.mutate(undefined, {
                    onSuccess: () => toast.success('Done'),
                    onError: () => toast.error('An Error Occured'),
                  })
                }}
              >
                <Show
                  fallback={<span>Optimize Server Storage</span>}
                  when={optimizeServerStorage.isPending}
                >
                  <Switch>
                    <Match when={serverOptimizationStatus.type === 'fetching'}>
                      <span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
                      <span>Fetching Latest Messages</span>
                    </Match>
                    <Match when={serverOptimizationStatus.type === 'sending'}>
                      <span class="icon-[svg-spinners--180-ring-with-bg] text-lg" />
                      <span>
                        {serverOptimizationStatus.processed} /{' '}
                        {serverOptimizationStatus.total} Messages Synced
                      </span>
                    </Match>
                  </Switch>
                </Show>
              </Button>
            </Show>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Danger</CardTitle>
          <CardDescription>
            The following settings can lead to data loss.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex max-sm:flex-col">
          <Button onClick={deleteAllData} type="button" variant="destructive">
            Delete All Data
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
