import { createEventListener } from '@solid-primitives/event-listener'
import { createShortcut } from '@solid-primitives/keyboard'
import { createWritableMemo } from '@solid-primitives/memo'
import { createElementSize } from '@solid-primitives/resize-observer'
import { debounce } from '@tanstack/solid-pacer'
import { useQuery } from '@tanstack/solid-query'
import {
  createEffect,
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSXElement,
  Match,
  onMount,
  Show,
  Switch,
  untrack,
} from 'solid-js'
import { toast } from 'solid-sonner'

import type { TChat, TLLMMessageChunk, TMessage } from '~/types/chat'

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
import { TextField, TextFieldTextArea } from './ui/text-field'

const AUTO_SCROLL_THRESHOLD = 50
const markdownWorker = makeNewMarkdownWorker()
const shikiWorker = makeNewShikiWorker()

export function Chat(props: {
  chat: TChat
  class?: string | undefined
  onDelete: (path: number[]) => void
  onEdit: (path: number[], content: string) => void
  onTraversal: (path: number[], direction: -1 | 1) => void
  onRegenerate: (path: number[]) => void
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
    messages()
      .iter(props.path)
      .map(({ node: nodeOption, path }) => {
        const node = nodeOption.unwrap()
        const siblings = node.parent.unwrap().children
        const pathIndex = path.at(-1)!
        return {
          pathIndex,
          node,
          numberOfSiblings: siblings.length,
        }
      })
      .toArray()

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
            {({ pathIndex, node, numberOfSiblings }, index) => {
              const message = () => node.value.unwrap()
              const currentPath = createMemo(() =>
                props.path.slice(0, index() + 1),
              )

              return (
                <Show
                  fallback={
                    <UserChat
                      index={pathIndex}
                      numberOfSiblings={numberOfSiblings}
                      message={message() as TMessage & { type: 'user' }}
                      onDelete={
                        index() === 0 && props.path[0] === 0
                          ? undefined
                          : props.onDelete.bind(null, currentPath())
                      }
                      onEdit={props.onEdit.bind(null, currentPath())}
                      onTraversal={props.onTraversal.bind(null, currentPath())}
                    />
                  }
                  when={message().type === 'llm'}
                >
                  <LLMChat
                    message={message() as TMessage & { type: 'llm' }}
                    onRegenerate={props.onRegenerate.bind(null, currentPath())}
                    index={pathIndex}
                    numberOfSiblings={numberOfSiblings}
                    onDelete={props.onDelete.bind(null, currentPath())}
                    onTraversal={props.onTraversal.bind(null, currentPath())}
                  />
                </Show>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

function LLMChat(props: {
  message: TMessage & { type: 'llm' }
  index: number
  numberOfSiblings: number
  onDelete?: () => void
  onTraversal: (direction: -1 | 1) => void
  onRegenerate: () => void
}) {
  const hasNext = () => props.index < props.numberOfSiblings - 1
  const hasPrev = () => props.index > 0

  return (
    <Card class="bg-transparent border-none shadow-none">
      <CardHeader class="p-4 flex gap-4 flex-row items-center">
        <CardTitle class="text-sm flex items-center gap-2">
          <span>@llm</span>
          <Show when={!props.message.finished}>
            <span class="icon-[svg-spinners--180-ring-with-bg]" />
          </Show>
        </CardTitle>
        <div class="grow flex gap-2 justify-end items-center">
          <Button
            class="size-6"
            onClick={() => {
              props.onRegenerate()
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <span class="sr-only">Regenerate</span>
            <span class="icon-[heroicons--arrow-path]" />
          </Button>
          <Show when={props.onDelete}>
            <Button
              class="size-6"
              onClick={() => {
                const yes = confirm('Are you sure?')
                if (!yes) return
                props.onDelete!()
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <span class="sr-only">Delete</span>
              <span class="icon-[heroicons--trash]" />
            </Button>
          </Show>
          <Show when={hasPrev() || hasNext()}>
            <Button
              class="size-6"
              disabled={!hasPrev()}
              onClick={() => {
                props.onTraversal(-1)
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <span class="sr-only">Previous</span>
              <span class="icon-[heroicons--arrow-left]" />
            </Button>
            <span class="text-xs font-mono text-muted-foreground">
              {props.index + 1}/{props.numberOfSiblings}
            </span>
            <Button
              class="size-6"
              disabled={!hasNext()}
              onClick={() => {
                props.onTraversal(1)
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <span class="sr-only">Next</span>
              <span class="icon-[heroicons--arrow-right]" />
            </Button>
          </Show>
        </div>
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
            class="rounded border p-3 text-xs overflow-auto"
            innerHTML={requestHtml.isSuccess ? requestHtml.data : ''}
          />
        </article>
        <article class="space-y-0.5">
          <h3 class="text-muted-foreground text-sm">Response:</h3>
          <div
            class="rounded border p-3 text-xs max-h-96 overflow-auto whitespace-pre"
            innerHTML={props.chunk.content}
          />
        </article>
      </CollapsibleContent>
    </Collapsible>
  )
}

function UserChat(props: {
  index: number
  numberOfSiblings: number
  message: TMessage & { type: 'user' }
  onDelete?: () => void
  onEdit: (content: string) => void
  onTraversal: (direction: -1 | 1) => void
}) {
  const hasNext = () => props.index < props.numberOfSiblings - 1
  const hasPrev = () => props.index > 0

  return (
    <For each={props.message.chunks}>
      {(chunk) => {
        const [editing, setEditing] = createSignal<boolean>(false)
        const [content, setContent] = createWritableMemo<string>(
          () => chunk.content,
        )
        const id = createUniqueId()
        const html = useQuery(() => ({
          queryKey: ['html', chunk.id],
          queryFn: () => markdownWorker.renderAsync(content()),
          staleTime: Infinity,
        }))

        createShortcut(
          ['Control', 'Enter'],
          (event) => {
            if (!event) return
            if (document.activeElement?.id === `prompt:${id}`) {
              event.preventDefault()
              const input = document.activeElement as HTMLTextAreaElement
              input.blur()
              setEditing(false)
              props.onEdit(content())
            }
          },
          { preventDefault: false },
        )

        return (
          <Card>
            <CardHeader class="p-4 flex gap-4 flex-row items-center">
              <CardTitle class="text-sm">@user</CardTitle>
              <div class="grow flex gap-2 justify-end items-center">
                <Show
                  fallback={
                    <>
                      <Button
                        class="size-6"
                        onClick={() => {
                          setEditing(false)
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <span class="sr-only">Cancel</span>
                        <span class="icon-[heroicons--x-mark]" />
                      </Button>
                      <Button
                        class="size-6"
                        onClick={() => {
                          setEditing(false)
                          props.onEdit(content())
                        }}
                        size="icon"
                        type="button"
                        variant="ghost"
                      >
                        <span class="sr-only">Save</span>
                        <span class="icon-[heroicons--check]" />
                      </Button>
                    </>
                  }
                  when={!editing()}
                >
                  <Button
                    class="size-6"
                    onClick={() => {
                      navigator.clipboard.writeText(chunk.content)
                      toast.success('Copied to clipboard')
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <span class="sr-only">Copy</span>
                    <span class="icon-[heroicons--clipboard-document]" />
                  </Button>
                  <Button
                    class="size-6"
                    onClick={() => {
                      setEditing(true)
                      queueMicrotask(() => {
                        const input = document.getElementById(
                          `prompt:${id}`,
                        ) as HTMLTextAreaElement
                        input.focus()
                      })
                    }}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <span class="sr-only">Edit</span>
                    <span class="icon-[heroicons--pencil]" />
                  </Button>
                  <Show when={props.onDelete}>
                    <Button
                      class="size-6"
                      onClick={() => {
                        const yes = confirm('Are you sure?')
                        if (!yes) return
                        props.onDelete!()
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <span class="sr-only">Delete</span>
                      <span class="icon-[heroicons--trash]" />
                    </Button>
                  </Show>
                  <Show when={hasPrev() || hasNext()}>
                    <Button
                      class="size-6"
                      disabled={!hasPrev()}
                      onClick={() => {
                        props.onTraversal(-1)
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <span class="sr-only">Previous</span>
                      <span class="icon-[heroicons--arrow-left]" />
                    </Button>
                    <span class="text-xs font-mono text-muted-foreground">
                      {props.index + 1}/{props.numberOfSiblings}
                    </span>
                    <Button
                      class="size-6"
                      disabled={!hasNext()}
                      onClick={() => {
                        props.onTraversal(1)
                      }}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <span class="sr-only">Next</span>
                      <span class="icon-[heroicons--arrow-right]" />
                    </Button>
                  </Show>
                </Show>
              </div>
            </CardHeader>
            <CardContent class="p-4 pt-0">
              <Show
                fallback={
                  <TextField>
                    <TextFieldTextArea
                      class="min-h-12 text-sm"
                      id={`prompt:${id}`}
                      onChange={(e) => setContent(e.target.value)}
                      value={content()}
                    />
                  </TextField>
                }
                when={!editing()}
              >
                <div
                  class="max-w-none prose dark:prose-invert whitespace-pre-wrap"
                  innerHTML={html.isSuccess ? html.data : ''}
                />
              </Show>
            </CardContent>
          </Card>
        )
      }}
    </For>
  )
}

export default Chat
