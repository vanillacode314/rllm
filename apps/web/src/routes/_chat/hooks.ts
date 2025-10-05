import { createShortcut } from '@solid-primitives/keyboard'
import { makePersisted } from '@solid-primitives/storage'
import { debounce } from '@tanstack/solid-pacer'
import { useMutation, useQuery } from '@tanstack/solid-query'
import { nanoid } from 'nanoid'
import { type Accessor, batch, createMemo, createSignal } from 'solid-js'
import {
  createMutable,
  createStore,
  modifyMutable,
  reconcile,
} from 'solid-js/store'
import { toast } from 'solid-sonner'
import { Option } from 'ts-result-option'

import type { TChat, TMessage } from '~/types/chat'

import { queries } from '~/queries'
import { openAiAdapter } from '~/utils/adapters/openai'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { ReactiveTreeNode, type TTree } from '~/utils/tree'

import { getLatestPath } from './utils'
import { getChunksForPath } from '~/utils/chat'

interface UseChatSessionOptions {
  chat: Accessor<TChat>
  initialSelectedPath: number[]
  isNewChat: boolean
  onChatCompletionSuccess?: (chat: TChat) => Promise<void> | void
}

export function useChatSession(options: UseChatSessionOptions) {
  const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
    name: 'rllm:prompt',
  })

  const selectedProviderId = useQuery(() => queries.providers.selected())
  const selectedModelId = useQuery(() => queries.models.selected())
  const selectedProvider = useQuery(() =>
    queries.providers.byId(
      selectedProviderId.isSuccess ? selectedProviderId.data : undefined,
    ),
  )
  const [selectedPath, setSelectedPath] = createStore(
    options.initialSelectedPath,
  )

  const currentNode = () =>
    options.chat().messages.traverse(selectedPath).unwrap()

  const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'))
  const proxifyUrl = (url: string) =>
    proxyUrl.isSuccess && proxyUrl.data ? proxyUrl.data.replace('%s', url) : url
  const baseUrl = createMemo(() =>
    Option.fromUndefinedOrNull(
      selectedProvider.isSuccess ? selectedProvider.data : null,
    ).map((data) => proxifyUrl(data.baseUrl)),
  )

  const fetcher = useQuery(() => ({
    enabled: selectedProvider.isSuccess,
    queryKey: [
      'fetcher',
      {
        token: selectedProvider.isSuccess ? selectedProvider.data.token : null,
        url: baseUrl(),
      },
    ] as const,
    queryFn: ({ queryKey: [, { token, url }] }) =>
      openAiAdapter.makeFetcher(url, Option.fromNull(token)),
  }))

  const mcpClients = useQuery(() =>
    queries.mcps.all()._ctx.clients(proxyUrl.data),
  )

  function finalizeChat() {
    const node = currentNode()
    node.value.inspect((value) => {
      if (value.type !== 'llm') {
        console.error('currentNode is not an llm message')
        return
      }
      value.finished = true
    })
  }

  const invalidateChunk = (id: string) => {
    queryClient.invalidateQueries({
      queryKey: ['html', id],
    })
  }

  let controller = new AbortController()
  const sendPrompt = useMutation(() => ({
    onMutate() {
      batch(() => {
        setPrompt('')
        const node = currentNode()
        node.addChild(
          new ReactiveTreeNode(
            createMutable({
              type: 'llm' as const,
              chunks: [],
              finished: false,
            }),
          ),
        )
        setSelectedPath(selectedPath.length, node.children.length - 1)
      })
    },
    mutationFn: async () => {
      controller.abort()
      controller = new AbortController()

      const chunks = getChunksForPath(
        selectedPath,
        options.chat().messages,
      ).unwrap()

      const tools = await Option.fromUndefinedOrNull(mcpClients.data)
        .map((clients) =>
          Promise.all(
            clients
              .values()
              .filter((client) => client.status === 'connected')
              .map((client) => client.listTools()),
          ).then((value) => value.flat()),
        )
        .transposePromise()

      let debouncedInvalidateChunk = () => {}
      let currentChunkId: null | string = null
      await openAiAdapter
        .handleChatCompletion({
          chunks,
          fetcher: fetcher.data!,
          model: selectedModelId.data!,
          tools,
          onChunk: Option.Some(async (chunks) => {
            if (chunks.length === 0) return
            const node = currentNode()
            node.value.inspect((value) =>
              modifyMutable(value.chunks, reconcile(chunks)),
            )
            const chunkId = chunks.at(-1)!.id
            if (currentChunkId !== chunkId) {
              currentChunkId = chunkId
              debouncedInvalidateChunk = debounce(
                () => invalidateChunk(chunkId),
                { wait: 16 },
              )
            }
            debouncedInvalidateChunk()
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
        user_intent: options.isNewChat ? 'create_chat' : 'update_chat',
        meta: {
          id: options.chat().id,
          title: options.chat().title,
          messages: options.chat().messages.toJSON(),
        },
      })
      await options.onChatCompletionSuccess?.(options.chat())
      await Promise.all([
        queryClient.invalidateQueries(queries.chats.all()),
        queryClient.invalidateQueries(queries.chats.byId(options.chat().id)),
      ])
    },
  }))

  function onSubmit(inputPrompt: string): void {
    const isPromptEmpty = inputPrompt.trim().length === 0
    const shouldAddPrompt = currentNode().value.isNoneOr(
      (node) => node.type !== 'user',
    )
    if (isPromptEmpty && shouldAddPrompt) {
      toast.error('Prompt is empty')
      return
    }
    if (shouldAddPrompt) {
      batch(() => {
        currentNode().addChild(
          new ReactiveTreeNode({
            type: 'user',
            chunks: [{ id: nanoid(), content: inputPrompt, type: 'text' }],
          }),
        )
        setSelectedPath(selectedPath.length, 0)
      })
    }
    sendPrompt.mutate()
  }

  // TODO: account for chunk index
  function onEdit(path: number[], content: string) {
    const parentNode = path.slice(0, -1).reduce((node, index) => {
      const child = node.children[index]
      if (!child) throw new Error('Invalid path')
      return child
    }, options.chat().messages)
    parentNode.addChild(
      new ReactiveTreeNode({
        type: 'user',
        chunks: [{ id: nanoid(), content, type: 'text' }],
      }),
    )
    setSelectedPath(path.slice(0, -1).concat(parentNode.children.length - 1))
    sendPrompt.mutate()
  }

  function onRegenerate(path: number[]) {
    setSelectedPath(path.slice(0, -1))
    sendPrompt.mutate()
  }

  function onTraversal(path: number[], direction: -1 | 1) {
    const rootPath = path.slice(0, -1).concat(path.at(-1)! + direction)
    const messages = options.chat().messages.traverse(rootPath).unwrap()
    const newPath = rootPath.concat(getLatestPath(messages))
    setSelectedPath(newPath)
  }

  async function onDelete(path: number[]) {
    const parentNode = options
      .chat()
      .messages.traverse(path.slice(0, -1))
      .unwrap()
    setSelectedPath(path.slice(0, -1))
    if (parentNode.children.length === 1) {
      parentNode.removeChild(path.at(-1)!)
    } else if (path.at(-1) === parentNode.children.length - 1) {
      parentNode.removeChild(path.at(-1)!)
      onTraversal(path, -1)
    } else {
      parentNode.removeChild(path.at(-1)!)
      setSelectedPath(
        path.concat(getLatestPath(parentNode.children[path.at(-1)!])),
      )
    }
    await createMessages({
      user_intent: 'update_chat',
      meta: {
        id: options.chat().id,
        title: options.chat().title,
        messages: options.chat().messages.toJSON(),
      },
    })
    await Promise.all([
      queryClient.invalidateQueries(queries.chats.all()),
      queryClient.invalidateQueries(queries.chats.byId(options.chat().id)),
    ])
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

  return {
    prompt,
    onEdit,
    setPrompt,
    onTraversal,
    selectedPath,
    onDelete,
    getLatestPath,
    onRegenerate,
    setSelectedPath,
    selectedModelId: () => selectedModelId.data,
    fetcher,
    isPending: () => sendPrompt.isPending,
    onSubmit,
    abortCompletion: () => controller.abort(),
  }
}
