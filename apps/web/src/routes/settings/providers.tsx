import { useQuery } from '@tanstack/solid-query'
import { createFileRoute } from '@tanstack/solid-router'
import { For } from 'solid-js'
import { setAddProviderModalOpen } from '~/components/modals/auto-import/AddProviderModal'
import { setEditProviderModalOpen } from '~/components/modals/auto-import/EditProviderModal'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { queries } from '~/queries'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'

export const Route = createFileRoute('/settings/providers')({
  component: SettingsProviderComponent,
  loader: async () => {
    return queryClient.ensureQueryData(queries.providers.all())
  },
})

function SettingsProviderComponent() {
  const providers = useQuery(queries.providers.all)

  async function deleteProvider(id: string) {
    await createMessages({
      user_intent: 'delete_provider',
      meta: { id },
    })
    await queryClient.invalidateQueries(queries.providers.all())
    await queryClient.invalidateQueries(queries.providers.byId(id))
  }

  return (
    <div class="grid grid-rows-[auto_1fr] gap-8">
      <div class="flex justify-end items-center">
        <Button onClick={() => setAddProviderModalOpen(true)}>
          Add Provider
        </Button>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4 self-start">
        <For each={providers.data}>
          {(provider) => (
            <Card>
              <CardHeader>
                <CardTitle>{provider.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{provider.baseUrl}</p>
              </CardContent>
              <CardFooter class="justify-end gap-2">
                <Button
                  onClick={() => setEditProviderModalOpen(provider.id)}
                  variant="secondary"
                >
                  Edit
                </Button>
                <Button
                  onClick={() => deleteProvider(provider.id)}
                  variant="destructive"
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          )}
        </For>
      </div>
    </div>
  )
}
