import { useQuery } from '@tanstack/solid-query'
import { createFileRoute } from '@tanstack/solid-router'
import { For } from 'solid-js'
import { setAddMCPModalOpen } from '~/components/modals/auto-import/AddMCPModal'
import { setEditMCPModalOpen } from '~/components/modals/auto-import/EditMCPModal'
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

export const Route = createFileRoute('/settings/mcp')({
  component: SettingsProviderComponent,
  loader: async () => {
    return queryClient.ensureQueryData(queries.mcps.all())
  },
})

function SettingsProviderComponent() {
  const mcps = useQuery(queries.mcps.all)

  async function deleteMCP(id: string) {
    await createMessages({
      user_intent: 'delete_mcp',
      meta: { id },
    })
    await queryClient.invalidateQueries(queries.mcps.all())
    await queryClient.invalidateQueries(queries.mcps.byId(id))
  }

  return (
    <div class="grid grid-rows-[auto_1fr] gap-8">
      <div class="flex justify-end items-center">
        <Button onClick={() => setAddMCPModalOpen(true)}>Add MCP</Button>
      </div>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-4 self-start">
        <For each={mcps.data}>
          {(mcp) => (
            <Card>
              <CardHeader>
                <CardTitle>{mcp.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{mcp.url}</p>
              </CardContent>
              <CardFooter class="justify-end gap-2">
                <Button
                  onClick={() => setEditMCPModalOpen(mcp.id)}
                  variant="secondary"
                >
                  Edit
                </Button>
                <Button onClick={() => deleteMCP(mcp.id)} variant="destructive">
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
