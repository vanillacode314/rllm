import { createShortcut } from '@solid-primitives/keyboard'
import { makePersisted } from '@solid-primitives/storage'
import { debounce } from '@tanstack/solid-pacer'
import { useMutation, useQuery } from '@tanstack/solid-query'
import { createFileRoute } from '@tanstack/solid-router'
import { nanoid } from 'nanoid'
import { batch, createMemo, createSignal } from 'solid-js'
import {
  createMutable,
  createStore,
  modifyMutable,
  reconcile,
} from 'solid-js/store'
import { toast } from 'solid-sonner'
import { Option } from 'ts-result-option'

import type { TChat, TMessage } from '~/types/chat'

import Chat from '~/components/Chat'
import { ModelSelector } from '~/components/ModelSelector'
import PromptBox from '~/components/PromptBox'
import { ProviderSelector } from '~/components/ProviderSelector'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { queries } from '~/queries'
import { openAiAdapter } from '~/utils/adapters/openai'
import { MCPClient } from '~/utils/mcp/client'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { slugify } from '~/utils/string'
import { ReactiveTree, Tree } from '~/utils/tree'

export const Route = createFileRoute('/_chat/')({
  component: IndexComponent,
  loader: () => {
    return { tools: [] }
  },
})

function IndexComponent() {
  const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
    name: 'prompt',
  })
  const [chat, setChat] = createStore<TChat>({
    id: nanoid(),
    title: 'Untitled Chat',
    messages: new ReactiveTree(),
  })
  const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'))
  const proxifyUrl = (url: string) =>
    proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url
  const selectedProviderId = useQuery(() => queries.providers.selected())
  const selectedProvider = useQuery(() => ({
    ...queries.providers.byId(selectedProviderId.data!),
    enabled: !!selectedProviderId.data,
  }))
  const selectedModelId = useQuery(() => queries.models.selected())

  const [selectedPath, setSelectedPath] = createStore([] as number[])

  const data = Route.useLoaderData()

  const currentNode = (messages: Tree<TMessage>) =>
    selectedPath.reduce((node, index) => node.children[index], messages)

  const resetChat = () =>
    batch(() => {
      setSelectedPath([])
      setChat({
        id: '',
        title: '',
        messages: new ReactiveTree(),
      })
    })

  const baseUrl = () =>
    Option.fromUndefinedOrNull(selectedProvider.data).map((data) =>
      proxifyUrl(data.baseUrl),
    )

  const fetcher = useQuery(() => ({
    enabled: selectedProvider.isSuccess,
    queryKey: [
      'fetcher',
      { token: selectedProvider.data!.token ?? null, url: baseUrl() },
    ] as const,
    queryFn: ({ queryKey: [, { token, url }] }) =>
      openAiAdapter.makeFetcher(url, Option.Some(token)),
  }))

  const mcpClients = useQuery(() =>
    queries.mcps.all()._ctx.clients(proxyUrl.data),
  )

  const navigate = Route.useNavigate()

  function finalizeChat() {
    const node = currentNode(chat.messages)
    node.value.inspect((value) => {
      if (value.type !== 'llm') {
        console.error('currentNode is not an llm message')
        return
      }
      value.finished = true
    })
  }

  const invalidateChunk = debounce(
    (id: string) =>
      queryClient.invalidateQueries({
        queryKey: ['html', id],
      }),
    { wait: 16 },
  )

  let controller = new AbortController()
  const sendPrompt = useMutation(() => ({
    onMutate() {
      batch(() => {
        setPrompt('')
        currentNode(chat.messages).addChild(
          createMutable({
            type: 'llm',
            chunks: [],
            finished: false,
          }),
        )
        setSelectedPath(selectedPath.length, 0)
      })
    },
    mutationFn: async () => {
      controller.abort()
      controller = new AbortController()

      const chunks = selectedPath
        .values()
        .reduce(
          (value, index) => {
            const child = value.node.children[index]
            if (child.value.isNone()) {
              throw new Error('Invalid path')
            }
            value.chunks.push(child.value.unwrap())
            value.node = child
            return value
          },
          { chunks: [] as TMessage[], node: chat.messages },
        )
        .chunks.values()
        .toArray()

      const tools = await Option.fromUndefinedOrNull(mcpClients.data)
        .map((clients) =>
          Promise.all(clients.map((client) => client.listTools())).then(
            (value) => value.flat(),
          ),
        )
        .transposePromise()

      await openAiAdapter
        .handleChatCompletion({
          chunks,
          fetcher: fetcher.data!,
          model: selectedModelId.data!,
          prompt: Option.Some(prompt()),
          tools,
          onChunk: Option.Some(async (chunks) => {
            if (chunks.length === 0) return
            const node = currentNode(chat.messages)
            node.value.inspect((value) =>
              modifyMutable(value.chunks, reconcile(chunks)),
            )
            const chunk = chunks.at(-1)!
            invalidateChunk(chunk.id)
          }),
          onAbort: Option.Some(finalizeChat),
          signal: Option.Some(controller.signal),
        })
        .unwrap()
    },
    onError(error) {
      console.error(error)
    },
    async onSuccess() {
      finalizeChat()
      await createMessages({
        user_intent: 'create_chat',
        meta: {
          id: chat.id,
          title: chat.title,
          messages: chat.messages.toJSON(),
        },
      })
      await navigate({
        to: `/chat/${chat.id}--${slugify(chat.title)}`,
        replace: true,
      })
      await Promise.all([
        queryClient.invalidateQueries(queries.chats.all()),
        queryClient.invalidateQueries(queries.chats.byId(chat.id)),
      ])
    },
  }))

  function onSubmit(prompt: string): void {
    if (prompt.trim().length === 0) {
      toast.error('Prompt is empty')
      return
    }
    batch(() => {
      currentNode(chat.messages).addChild({
        type: 'user',
        chunks: [{ id: nanoid(), content: prompt, type: 'text' }],
      })
      setSelectedPath(selectedPath.length, 0)
    })
    sendPrompt.mutate()
  }

  createShortcut(
    ['Control', 'Enter'],
    (event) => {
      if (!event) return
      if (document.activeElement?.id === 'prompt') {
        event.preventDefault()
        const form = document.getElementById('message-form') as HTMLFormElement
        if (!form) throw new Error('form missing')
        form.requestSubmit()
      }
    },
    { preventDefault: false },
  )

  return (
    <main class="h-full grid mx-auto grid-rows-[auto_1fr_auto] w-full overflow-hidden">
      <div class="grid grid-cols-[auto_1fr] sm:grid-cols-[1fr_250px_250px] gap-4 items-center p-4">
        <SidebarTrigger />
        <ProviderSelector />
        <ModelSelector class="max-sm:col-span-2" fetcher={fetcher.data!} />
      </div>
      <Chat chat={chat} class="pt-0 p-4" path={selectedPath} />
      <PromptBox
        class="pt-0 p-4"
        isPending={sendPrompt.isPending}
        onAbort={() => controller.abort()}
        onSubmit={onSubmit}
      />
    </main>
  )
}
