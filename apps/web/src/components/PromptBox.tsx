import { makePersisted } from '@solid-primitives/storage'
import { useQuery } from '@tanstack/solid-query'
import { useNavigate } from '@tanstack/solid-router'
import { createEffect, createSignal, For, Match, Show, Switch } from 'solid-js'

import { queries } from '~/queries'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { cn } from '~/utils/tailwind'

import { ExpandableTextField } from './ExpandableTextField'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export function PromptBox(props: {
  chatId?: string
  class?: string | undefined
  isPending: boolean
  onAbort: () => void
  onSubmit: (prompt: string) => void
}) {
  const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
    name: 'prompt',
  })

  const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'))
  const mcpClients = useQuery(() =>
    queries.mcps.all()._ctx.clients(proxyUrl.data),
  )

  const navigate = useNavigate()
  return (
    <div class={cn('flex flex-col gap-4 h-full', props.class)}>
      <form
        class="grid gap-4 items-end"
        id="message-form"
        onSubmit={(event) => {
          event.preventDefault()
          props.onSubmit(prompt())
          setPrompt('')
        }}
        style={{
          'grid-template-columns': props.chatId ? 'auto 1fr auto' : '1fr auto',
        }}
      >
        <Show when={props.chatId}>
          <Button
            onClick={async () => {
              const yes = confirm('Are you sure you want to delete this chat?')
              if (!yes) return
              await navigate({ to: '/' })
              await createMessages({
                user_intent: 'delete_chat',
                meta: {
                  id: props.chatId!,
                },
              })
              await Promise.all([
                queryClient.invalidateQueries(queries.chats.all()),
                queryClient.invalidateQueries(
                  queries.chats.byId(props.chatId!),
                ),
              ])
            }}
            size="icon"
            type="button"
            variant="destructive"
          >
            <span class="icon-[heroicons--trash] text-xl" />
            <span class="sr-only">Delete chat</span>
          </Button>
        </Show>
        <ExpandableTextField
          id="prompt"
          name="prompt"
          onInput={(e) => setPrompt(e.currentTarget.value)}
          placeholder="Message"
          value={prompt()}
        />
        <div class="flex flex-col gap-4">
          <Show
            fallback={
              <Button
                onClick={() => props.onAbort()}
                size="icon"
                type="button"
                variant="secondary"
              >
                <span class="icon-[svg-spinners--180-ring-with-bg] text-xl" />
                <span class="sr-only">Cancel</span>
              </Button>
            }
            when={!props.isPending}
          >
            <Button size="icon" type="submit">
              <span class="icon-[heroicons--arrow-right] text-xl" />
              <span class="sr-only">Send message</span>
            </Button>
          </Show>
        </div>
      </form>
      <div class="flex gap-4 items-center">
        <For each={mcpClients.data}>
          {(mcp) => (
            <Badge
              class="flex gap-1 items-center"
              variant={mcp.status === 'connected' ? 'secondary' : 'outline'}
            >
              <Switch>
                <Match when={mcp.status === 'connecting'}>
                  <span class="icon-[svg-spinners--180-ring-with-bg]" />
                </Match>
                <Match when={mcp.status === 'connected'}>
                  <span class="icon-[heroicons--check-circle]" />
                </Match>
                <Match when={mcp.status === 'disconnected'}>
                  <span class="icon-[heroicons--x-circle]" />
                </Match>
              </Switch>
              <span>{mcp.name}</span>
            </Badge>
          )}
        </For>
      </div>
    </div>
  )
}

export default PromptBox
