import { createShortcut } from '@solid-primitives/keyboard'
import { makePersisted } from '@solid-primitives/storage'
import { debounce } from '@tanstack/solid-pacer'
import { useMutation, useQuery } from '@tanstack/solid-query'
import { createFileRoute, redirect } from '@tanstack/solid-router'
import { nanoid } from 'nanoid'
import { batch, createMemo, createSignal } from 'solid-js'
import {
  createMutable,
  createStore,
  modifyMutable,
  reconcile,
} from 'solid-js/store'
import { Option } from 'ts-result-option'

import type { TMessage } from '~/types/chat'

import Chat from '~/components/Chat'
import { ModelSelector } from '~/components/ModelSelector'
import PromptBox from '~/components/PromptBox'
import { ProviderSelector } from '~/components/ProviderSelector'
import { Button } from '~/components/ui/button'
import { SidebarTrigger } from '~/components/ui/sidebar'
import { queries } from '~/queries'
import { openAiAdapter } from '~/utils/adapters/openai'
import { MCPClient } from '~/utils/mcp/client'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { ReactiveTree, Tree } from '~/utils/tree'

export const Route = createFileRoute('/_chat/chat/$key')({
  component: ChatPageComponent,
  beforeLoad: async ({ params }) => {
    const [id, title] = params.key.split('--')
    if (id === undefined || title == undefined) throw redirect({ to: '/' })

    const chat = await queryClient.ensureQueryData(queries.chats.byId(id))
    if (chat === null) throw redirect({ to: '/' })

    return { id }
  },
  pendingComponent() {
    return <div class="fixed inset-0 bg-red-400 z-10" />
  },
  loader: async ({ context }) => {
    return { id: context.id, tools: [] }
  },
})

function ChatPageComponent() {
  const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
    name: 'prompt',
  })

  const data = Route.useLoaderData()
  const serverChat = useQuery(() => queries.chats.byId(data().id))
  const chat = createMemo(() => ({
    id: serverChat.data!.id,
    title: serverChat.data!.title,
    messages: ReactiveTree.fromJSON<TMessage>(serverChat.data!.messages),
  }))

  const selectedProviderId = useQuery(() => queries.providers.selected())
  const selectedModelId = useQuery(() => queries.models.selected())
  const selectedProvider = useQuery(() =>
    queries.providers.byId(selectedProviderId.data),
  )

  function getLatestPath(messages: Tree<TMessage>, path: number[] = []) {
    if (messages.children.length === 0) return path
    path.push(messages.children.length - 1)
    return getLatestPath(messages.children[messages.children.length - 1], path)
  }

  const [selectedPath, setSelectedPath] = createStore(
    getLatestPath(chat().messages),
  )

  const currentNode = (messages: Tree<TMessage>) =>
    selectedPath.reduce((node, index) => node.children[index], messages)

  const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'))
  const proxifyUrl = (url: string) =>
    proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url
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

  function finalizeChat() {
    const node = currentNode(chat().messages)
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
        currentNode(chat().messages).addChild(
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
          { chunks: [] as TMessage[], node: chat().messages },
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
            const node = currentNode(chat().messages)
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
        user_intent: 'update_chat',
        meta: {
          id: chat().id,
          title: chat().title,
          messages: chat().messages.toJSON(),
        },
      })
      await Promise.all([
        queryClient.invalidateQueries(queries.chats.all()),
        queryClient.invalidateQueries(queries.chats.byId(chat().id)),
      ])
    },
  }))

  function onSubmit(prompt: string): void {
    if (prompt.trim().length === 0) {
      throw new Error('Prompt is empty')
    }
    batch(() => {
      currentNode(chat().messages).addChild({
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
      <Chat chat={chat()} class="pt-0 p-4" path={selectedPath} />
      <PromptBox
        chatId={chat().id}
        class="pt-0 p-4"
        isPending={sendPrompt.isPending}
        onAbort={() => controller.abort()}
        onSubmit={onSubmit}
      />
    </main>
  )
}
