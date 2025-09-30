import { useColorMode } from '@kobalte/core/color-mode'
import { useMutation } from '@tanstack/solid-query'
import { createFileRoute } from '@tanstack/solid-router'
import { sql } from 'drizzle-orm'
import { createSignal, onMount, Show } from 'solid-js'

import { Button } from '~/components/ui/button'
import { db, getDatabaseInfo } from '~/db/client'
import { createDebouncedMemo } from '~/utils/signals'

export const Route = createFileRoute('/settings/appearance')({
  component: SettingsStorageComponent,
})

function SettingsStorageComponent() {
  const { colorMode, setColorMode } = useColorMode()

  const [size, setSize] = createSignal<null | number>(null)

  onMount(updateSize)

  async function updateSize() {
    const info = await getDatabaseInfo()
    setSize(info.databaseSizeBytes ?? null)
  }

  const optimizeStorage = useMutation(() => ({
    mutationFn: async () => {
      await db.run(sql`VACUUM;`)
    },
    onSuccess: () => updateSize(),
  }))

  const optimizeStorageIsPending = createDebouncedMemo(
    () => optimizeStorage.isPending,
    false,
    {
      duration: 300,
    },
  )
  return (
    <div class="flex gap-2">
      <Button
        onClick={() => setColorMode('dark')}
        variant={colorMode() === 'dark' ? 'default' : 'secondary'}
      >
        <div class="icon-[heroicons--moon] text-lg" />
        <span>Dark</span>
      </Button>
      <Button
        onClick={() => setColorMode('light')}
        variant={colorMode() === 'light' ? 'default' : 'secondary'}
      >
        <div class="icon-[heroicons--sun] text-lg" />
        <span>Light</span>
      </Button>
      <Button onClick={() => setColorMode('system')} variant="outline">
        <div class="icon-[heroicons--computer-desktop] text-lg" />
        <span>Auto</span>
      </Button>
    </div>
  )
}
