import { useQuery } from '@tanstack/solid-query'
import { createFileRoute, redirect } from '@tanstack/solid-router'
import { createMemo } from 'solid-js'

import type { TMessage } from '~/types/chat'

import Chat from '~/components/Chat'
import { ModelSelector } from '~/components/ModelSelector'
import PromptBox from '~/components/PromptBox'
import { ProviderSelector } from '~/components/ProviderSelector'
import { Button } from '~/components/ui/button'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { queries } from '~/queries'
import { useChatSession } from '~/routes/_chat/hooks'
import { getLatestPath } from '~/routes/_chat/utils'
import { queryClient } from '~/utils/query-client'
import { ReactiveTree } from '~/utils/tree'

export const Route = createFileRoute('/_chat/chat/$key')({
  component: ChatPageComponent,
  beforeLoad: async ({ params }) => {
    const [id, title] = params.key.split('--')
    if (id === undefined || title == undefined) throw redirect({ to: '/' })

    const chat = await queryClient.ensureQueryData(queries.chats.byId(id))
    if (chat === null) throw redirect({ to: '/' })

    return { id }
  },
  loader: async ({ context }) => ({ id: context.id }),
})

function ChatPageComponent() {
  const data = Route.useLoaderData()
  const serverChat = useQuery(() => queries.chats.byId(data().id))

  const chat = createMemo(() => ({
    id: serverChat.data!.id,
    title: serverChat.data!.title,
    messages: ReactiveTree.fromJSON<TMessage>(serverChat.data!.messages),
  }))

  const {
    onRegenerate,
    onDelete,
    onEdit,
    selectedPath,
    fetcher,
    isPending,
    onSubmit,
    abortCompletion,
    onTraversal,
  } = useChatSession({
    chat,
    initialSelectedPath: getLatestPath(chat().messages),
    isNewChat: false,
  })

  const navigate = Route.useNavigate()

  return (
    <main class="h-full grid mx-auto grid-rows-[auto_1fr_auto] w-full overflow-hidden">
      <div class="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_250px_250px_auto] gap-2 items-center p-4">
        <SidebarTrigger />
        <ProviderSelector class="max-sm:col-span-2" />
        <ModelSelector class="max-sm:col-span-2" fetcher={fetcher.data!} />
        <Button
          onClick={() => navigate({ to: '/' })}
          size="icon"
          type="button"
          variant="ghost"
        >
          <span class="icon-[heroicons--plus-circle] text-xl" />
          <span class="sr-only">New chat</span>
        </Button>
      </div>
      <Chat
        chat={chat()}
        class="pt-0 p-4"
        onDelete={onDelete}
        onEdit={onEdit}
        onRegenerate={onRegenerate}
        onTraversal={onTraversal}
        path={selectedPath}
      />
      <PromptBox
        chatId={chat().id}
        class="pt-0 p-4"
        isPending={isPending()}
        onAbort={abortCompletion}
        onSubmit={onSubmit}
      />
    </main>
  )
}
