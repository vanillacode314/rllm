import { createEventListener } from '@solid-primitives/event-listener'
import { createElementSize } from '@solid-primitives/resize-observer'
import { debounce } from '@tanstack/solid-pacer'
import { useQuery } from '@tanstack/solid-query'
import {
  createEffect,
  createSignal,
  For,
  type JSXElement,
  Match,
  onMount,
  Show,
  Switch,
  untrack,
} from 'solid-js'

import type { TChat, TLLMMessageChunk, TMessage } from '~/types/chat'
import type { TreeNode } from '~/utils/tree'

import { cn } from '~/utils/tailwind'
import { makeNewMarkdownWorker } from '~/workers/markdown'
import { makeNewShikiWorker } from '~/workers/shiki'

import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible'

const AUTO_SCROLL_THRESHOLD = 50
const markdownWorker = makeNewMarkdownWorker()
const shikiWorker = makeNewShikiWorker()

export function Chat(props: {
  chat: TChat
  class?: string | undefined
  path: number[]
}): JSXElement {
  let ref!: HTMLDivElement
  let overflowWrapperRef!: HTMLDivElement

  const overflowWrapperRefSize = createElementSize(() => overflowWrapperRef)
  const [manualScrolling, setManualScrolling] = createSignal(false)
  const [autoScrolling, setAutoScrolling] = createSignal(false)

  onMount(() =>
    setManualScrolling(
      ref.scrollHeight >= ref.clientHeight + AUTO_SCROLL_THRESHOLD,
    ),
  )

  createEventListener(
    () => ref,
    'scroll',
    () => {
      if (autoScrolling()) return
      setManualScrolling(
        Math.abs(ref.scrollHeight - ref.scrollTop - ref.clientHeight) >
          AUTO_SCROLL_THRESHOLD,
      )
    },
    { passive: true },
  )

  const scrollToBottom = debounce(
    () => {
      setAutoScrolling(true)
      ref.addEventListener('scrollend', () => setAutoScrolling(false), {
        once: true,
        passive: true,
      })
      ref.scrollTo({
        top: ref.scrollHeight - ref.clientHeight,
        behavior: 'smooth',
      })
    },
    { wait: 16 },
  )

  createEffect(() => {
    const height = overflowWrapperRefSize.height
    if (!height || untrack(manualScrolling)) return
    scrollToBottom()
  })

  const messages = () => props.chat.messages
  const nodes = () =>
    props.path.reduce(
      ({ nodes, node }, index) => {
        node = node.children[index]
        nodes.push(node)
        return { nodes, node }
      },
      {
        nodes: [] as TreeNode<TMessage>[],
        node: messages(),
      },
    ).nodes

  return (
    <div class="flex flex-col relative overflow-hidden">
      <Show when={manualScrolling()}>
        <Button
          class="absolute bottom-4 right-4 size-8"
          onClick={() => {
            scrollToBottom()
            setManualScrolling(false)
          }}
          size="icon"
          variant="secondary"
        >
          <span class="icon-[heroicons--arrow-down] text-xs" />
        </Button>
      </Show>
      <div class={cn('overflow-auto', props.class)} ref={ref}>
        <div class="flex flex-col gap-4" ref={overflowWrapperRef}>
          <For each={nodes()}>
            {(node) => {
              const message = () => node.value.unwrap()
              return (
                <Show
                  fallback={
                    <UserChat
                      message={message() as TMessage & { type: 'user' }}
                    />
                  }
                  when={message().type === 'llm'}
                >
                  <LLMChat message={message() as TMessage & { type: 'llm' }} />
                </Show>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

function LLMChat(props: { message: TMessage & { type: 'llm' } }) {
  return (
    <Card class="bg-transparent border-none shadow-none">
      <CardHeader class="p-4">
        <CardTitle class="text-sm flex items-center gap-2">
          <span>@llm</span>
          <Show when={!props.message.finished}>
            <span class="icon-[svg-spinners--180-ring-with-bg]" />
          </Show>
        </CardTitle>
      </CardHeader>
      <CardContent class="space-y-5 p-4 pt-0 overflow-x-auto">
        <For each={props.message.chunks}>
          {(chunk) => (
            <Switch>
              <Match when={chunk.type === 'reasoning'}>
                <LLMReasoningChunk
                  chunk={chunk as TLLMMessageChunk & { type: 'reasoning' }}
                />
              </Match>
              <Match when={chunk.type === 'tool_call'}>
                <LLMToolCallChunk
                  chunk={chunk as TLLMMessageChunk & { type: 'tool_call' }}
                />
              </Match>
              <Match when={true}>
                <LLMTextChunk
                  chunk={chunk as TLLMMessageChunk & { type: 'text' }}
                />
              </Match>
            </Switch>
          )}
        </For>
      </CardContent>
    </Card>
  )
}

function LLMReasoningChunk(props: {
  chunk: TLLMMessageChunk & { type: 'reasoning' }
}) {
  const finished = () => props.chunk.finished
  const html = useQuery(() => ({
    queryKey: ['html', props.chunk.id],
    queryFn: () => markdownWorker.renderAsync(props.chunk.content),
    staleTime: Infinity,
  }))

  return (
    <Collapsible class="space-y-1.5" defaultOpen={!finished()}>
      <CollapsibleTrigger class="text-sm opacity-90 flex w-full items-center gap-2">
        <span>Reasoning</span>
        <Show
          fallback={<span class="icon-[heroicons--chevron-up-down]" />}
          when={!finished()}
        >
          <span class="icon-[svg-spinners--180-ring-with-bg]" />
        </Show>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          class="text-muted-foreground max-w-none prose dark:prose-invert"
          innerHTML={html.isSuccess ? html.data : ''}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

function LLMTextChunk(props: { chunk: TLLMMessageChunk & { type: 'text' } }) {
  const html = useQuery(() => ({
    queryKey: ['html', props.chunk.id],
    queryFn: () => markdownWorker.renderAsync(props.chunk.content),
    staleTime: Infinity,
  }))

  return (
    <div
      class="max-w-none prose dark:prose-invert"
      innerHTML={html.isSuccess ? html.data : ''}
    />
  )
}

function LLMToolCallChunk(props: {
  chunk: TLLMMessageChunk & { type: 'tool_call' }
}) {
  const finished = () => props.chunk.finished
  const requestHtml = useQuery(() => ({
    queryKey: ['html', props.chunk.id],
    staleTime: Infinity,
    queryFn: () =>
      shikiWorker.codeToHtml(
        JSON.stringify(JSON.parse(props.chunk.tool.arguments), null, 2),
        {
          lang: 'json',
          themes: {
            dark: 'gruvbox-dark-hard',
            light: 'gruvbox-light-soft',
          },
          colorReplacements: {
            '#1d2021': 'var(--color-background)',
          },
        },
      ),
  }))

  return (
    <Collapsible class="space-y-1.5" defaultOpen={false}>
      <CollapsibleTrigger class="text-sm opacity-90 flex w-full items-center gap-2">
        <span>Tool Call ({props.chunk.tool.name})</span>
        <Show
          fallback={<span class="icon-[heroicons--chevron-up-down]" />}
          when={!finished()}
        >
          <span class="icon-[svg-spinners--180-ring-with-bg]" />
        </Show>
      </CollapsibleTrigger>
      <CollapsibleContent class="space-y-2">
        <article class="space-y-0.5">
          <h3 class="text-muted-foreground text-sm">Request:</h3>
          <div
            class="rounded border p-3 text-xs"
            innerHTML={requestHtml.isSuccess ? requestHtml.data : ''}
          />
        </article>
        <article class="space-y-0.5">
          <h3 class="text-muted-foreground text-sm">Response:</h3>
          <div
            class="rounded border p-3 text-xs max-h-96 overflow-y-auto whitespace-pre"
            innerHTML={props.chunk.content}
          />
        </article>
      </CollapsibleContent>
    </Collapsible>
  )
}

function UserChat(props: { message: TMessage & { type: 'user' } }) {
  return (
    <For each={props.message.chunks}>
      {(chunk) => {
        const html = useQuery(() => ({
          queryKey: ['html', chunk.id],
          queryFn: () => markdownWorker.renderAsync(chunk.content),
          staleTime: Infinity,
        }))

        return (
          <Card>
            <CardHeader class="p-4">
              <CardTitle class="text-sm">@raqueeb</CardTitle>
            </CardHeader>
            <CardContent class="p-4 pt-0">
              <div
                class="max-w-none prose dark:prose-invert"
                innerHTML={html.isSuccess ? html.data : ''}
              />
            </CardContent>
          </Card>
        )
      }}
    </For>
  )
}

export default Chat
