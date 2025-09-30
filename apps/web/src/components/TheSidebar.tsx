import { useQuery } from '@tanstack/solid-query'
import { Link, useLocation, useNavigate } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { queries } from '~/queries'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { slugify } from '~/utils/string'
import { ReactiveTree } from '~/utils/tree'

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
              {(item) => {
                const href = () => `/chat/${item.id}--${slugify(item.title)}`
                return (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      activeProps={{ class: 'font-bold' }}
                      as={Link}
                      onClick={() => sidebar.setOpenMobile(false)}
                      to={href()}
                    >
                      <span class="icon-[heroicons--chat-bubble-bottom-center-text] text-lg" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger as={SidebarMenuAction}>
                        <span class="icon-[heroicons--ellipsis-horizontal]" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onSelect={async () => {
                            const name = prompt(
                              'Enter a new name for this chat',
                            )
                            if (!name) return
                            await createMessages({
                              user_intent: 'update_chat',
                              meta: {
                                id: item.id,
                                title: name,
                                messages: item.messages,
                              },
                            })
                            if (location().pathname === href()) {
                              await navigate({
                                to: `/chat/${item.id}--${slugify(name)}`,
                              })
                            }
                            await Promise.all([
                              queryClient.invalidateQueries(
                                queries.chats.all(),
                              ),
                              queryClient.invalidateQueries(
                                queries.chats.byId(item.id),
                              ),
                            ])
                          }}
                        >
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={async () => {
                            const yes = confirm(
                              'Are you sure you want to delete this chat?',
                            )
                            if (!yes) return
                            if (location().pathname === href()) {
                              await navigate({ to: '/' })
                            }
                            await createMessages({
                              user_intent: 'delete_chat',
                              meta: {
                                id: item.id,
                              },
                            })
                            await Promise.all([
                              queryClient.invalidateQueries(
                                queries.chats.all(),
                              ),
                              queryClient.invalidateQueries(
                                queries.chats.byId(item.id),
                              ),
                            ])
                          }}
                        >
                          <span>Delete Chat</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )
              }}
            </For>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}

export default TheSidebar
