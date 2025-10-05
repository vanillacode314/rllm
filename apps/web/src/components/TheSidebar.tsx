import { createKeyHold } from '@solid-primitives/keyboard'
import { useQuery } from '@tanstack/solid-query'
import { Link, useLocation, useNavigate } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'

import type { TChat } from '~/db/schema'

import { useNotifications } from '~/context/notifications'
import { queries } from '~/queries'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { slugify } from '~/utils/string'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from './ui/sidebar'

export function TheSidebar() {
  const links = [
    {
      title: 'New Chat',
      url: '/',
      icon: 'icon-[heroicons--plus-circle]',
    },
    {
      title: 'Settings',
      url: '/settings',
      icon: 'icon-[heroicons--cog]',
    },
  ]

  const location = useLocation()
  const navigate = useNavigate()

  const chats = useQuery(() => ({
    ...queries.chats.all(),
    placeholderData: [],
  }))

  const sidebar = useSidebar()

  const [notifications] = useNotifications()
  const shiftKeyHeld = createKeyHold('Shift', { preventDefault: false })

  async function renameChat(chat: TChat) {
    const name = prompt('Enter a new name for this chat')
    if (!name) return
    await createMessages({
      user_intent: 'update_chat',
      meta: {
        id: chat.id,
        title: name,
        messages: chat.messages,
      },
    })
    const href = `/chat/${chat.id}`
    if (location().pathname.startsWith(href)) {
      await navigate({ to: href })
    }
    await Promise.all([
      queryClient.invalidateQueries(queries.chats.all()),
      queryClient.invalidateQueries(queries.chats.byId(chat.id)),
    ])
  }

  async function deleteChat(chat: TChat, shouldConfirm: boolean = true) {
    const yes =
      !shouldConfirm || confirm('Are you sure you want to delete this chat?')
    if (!yes) return
    const href = `/chat/${chat.id}`
    if (location().pathname.startsWith(href)) {
      await navigate({ to: '/' })
    }
    await createMessages({
      user_intent: 'delete_chat',
      meta: {
        id: chat.id,
      },
    })
    await Promise.all([
      queryClient.invalidateQueries(queries.chats.all()),
      queryClient.invalidateQueries(queries.chats.byId(chat.id)),
    ])
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <h3 class="font-bold tracking-wider text-lg p-2 pb-0">RLLM</h3>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <For each={links}>
                {(item) => (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      activeProps={{ class: 'font-bold' }}
                      as={Link}
                      onClick={() => sidebar.setOpenMobile(false)}
                      to={item.url}
                    >
                      <span class={`${item.icon} text-lg`} />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </For>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarMenu>
            <For each={chats.data}>
              {(chat) => {
                const href = () => `/chat/${chat.id}--${slugify(chat.title)}`
                return (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      activeProps={{ class: 'font-bold' }}
                      as={Link}
                      onClick={() => sidebar.setOpenMobile(false)}
                      title={chat.title}
                      to={href()}
                    >
                      {/* <span class="icon-[heroicons--chat-bubble-bottom-center-text] text-lg shrink-0" /> */}
                      <span class="truncate">{chat.title}</span>
                    </SidebarMenuButton>
                    <Show
                      fallback={
                        <div class="flex gap-2 items-center text-sm">
                          <SidebarMenuAction
                            onClick={() => deleteChat(chat, false)}
                          >
                            <span class="icon-[heroicons--trash]" />
                          </SidebarMenuAction>
                          <SidebarMenuAction
                            class="right-6"
                            onClick={() => renameChat(chat)}
                          >
                            <span class="icon-[heroicons--pencil]" />
                          </SidebarMenuAction>
                        </div>
                      }
                      when={!shiftKeyHeld()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger as={SidebarMenuAction}>
                          <span class="icon-[heroicons--ellipsis-horizontal]" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => renameChat(chat)}>
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => deleteChat(chat)}>
                            <span>Delete Chat</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Show>
                  </SidebarMenuItem>
                )
              }}
            </For>
          </SidebarMenu>
        </SidebarGroup>
        <span class="grow" />
        <SidebarGroup>
          <SidebarMenu>
            <For each={notifications}>
              {(notification) => (
                <SidebarMenuItem class="px-2 text-sm flex gap-2 items-center">
                  <span class="icon-[svg-spinners--90-ring-with-bg]" />
                  <span>{notification.content}</span>
                </SidebarMenuItem>
              )}
            </For>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}

export default TheSidebar
