import { createFileRoute } from '@tanstack/solid-router'
import { nanoid } from 'nanoid'
import { createStore } from 'solid-js/store'
import { toast } from 'solid-sonner'

import type { TChat } from '~/types/chat'

import Chat from '~/components/Chat'
import { ModelSelector } from '~/components/ModelSelector'
import PromptBox from '~/components/PromptBox'
import { ProviderSelector } from '~/components/ProviderSelector'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { useNotifications } from '~/context/notifications'
import { isMobile } from '~/signals'
import { openAiAdapter } from '~/utils/adapters/openai'
import { generateTitle } from '~/utils/adapters/utils'
import { getChunksForPath } from '~/utils/chat'
import { createMessages } from '~/utils/messages'
import { slugify } from '~/utils/string'
import { ReactiveTree } from '~/utils/tree'

import { useChatSession } from './hooks'

export const Route = createFileRoute('/_chat/')({
  component: IndexComponent,
})

function IndexComponent() {
  const [chat] = createStore<TChat>({
    id: nanoid(),
    title: 'Untitled Chat',
    messages: new ReactiveTree(),
  })
  const [, { createNotification, removeNotification }] = useNotifications()
  const navigate = Route.useNavigate()
  const {
    onRegenerate,
    selectedModelId,
    selectedPath,
    onDelete,
    fetcher,
    onSubmit,
    abortCompletion,
    isPending,
    onEdit,
    onTraversal,
  } = useChatSession({
    chat: () => chat,
    initialSelectedPath: [],
    isNewChat: true,
    async onChatCompletionSuccess(chat) {
      const chunks = getChunksForPath(selectedPath, chat.messages).unwrap()

      const notificationId = createNotification('Generating Title')
      let toastId: null | number | string = null
      if (isMobile()) {
        toastId = toast.loading('Generating Title')
      }
      const title = await generateTitle(
        openAiAdapter,
        fetcher.data!,
        selectedModelId()!,
        chunks,
      )
        .inspectErr((e) => console.log(e))
        .unwrapOr('Untitled Chat')

      await createMessages({
        user_intent: 'update_chat',
        meta: {
          id: chat.id,
          title,
          messages: chat.messages.toJSON(),
        },
      })
      removeNotification(notificationId)
      if (toastId !== null) {
        toast.dismiss(toastId)
      }

      await navigate({
        to: `/chat/${chat.id}--${slugify(title)}`,
        replace: true,
      })
    },
  })

  return (
    <main class="h-full grid mx-auto grid-rows-[auto_1fr_auto] w-full overflow-hidden">
      <div class="grid grid-cols-[auto_1fr] sm:grid-cols-[1fr_250px_250px] gap-4 items-center p-4">
        <SidebarTrigger />
        <ProviderSelector />
        <ModelSelector class="max-sm:col-span-2" fetcher={fetcher.data!} />
      </div>
      <Chat
        chat={chat}
        class="pt-0 p-4"
        onDelete={onDelete}
        onEdit={onEdit}
        onRegenerate={onRegenerate}
        onTraversal={onTraversal}
        path={selectedPath}
      />
      <PromptBox
        class="pt-0 p-4"
        isPending={isPending()}
        onAbort={abortCompletion}
        onSubmit={onSubmit}
      />
    </main>
  )
}
