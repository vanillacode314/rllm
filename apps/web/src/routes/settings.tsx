import {
  createFileRoute,
  Outlet,
  useLocation,
  useNavigate,
  redirect,
} from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from '~/components/ui/select'

import { SidebarTrigger } from '~/components/ui/sidebar'
import { Tabs, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { env } from '~/utils/env'

type Page = { name: string; path: string; condition?: () => boolean }
const PAGES: Page[] = [
  {
    name: 'Account',
    path: '/settings/account',
    condition: () => !!env.VITE_SYNC_SERVER_BASE_URL,
  },
  {
    name: 'Providers',
    path: '/settings/providers',
  },
  {
    name: 'MCP',
    path: '/settings/mcp',
  },
  {
    name: 'Proxy',
    path: '/settings/proxy',
  },
  {
    name: 'Storage',
    path: '/settings/storage',
  },
  {
    name: 'Appearance',
    path: '/settings/appearance',
  },
]

const filteredPages = () =>
  PAGES.filter((page) => !page.condition || page.condition())

export const Route = createFileRoute('/settings')({
  component: SettingsComponent,
  beforeLoad: ({ location }) => {
    if (!filteredPages().some((page) => page.path === location.pathname)) {
      throw redirect({ to: filteredPages()[0].path })
    }
  },
})
function SettingsComponent() {
  const location = useLocation()
  const currentPage = () => {
    const page = PAGES.find((page) => page.path === location().pathname)
    if (!page) {
      return PAGES[0]
    }
    return page
  }
  const navigate = useNavigate()

  return (
    <main class="h-full content-grid py-4 mx-auto grid-rows-[auto_auto] content-start gap-y-8 w-full">
      <div class="flex justify-between gap-4 items-center">
        <SidebarTrigger />
        <Select
          class="sm:hidden w-full"
          defaultValue={currentPage()}
          onChange={(value) => value && navigate({ to: value.path })}
          options={filteredPages()}
          optionValue="path"
          optionTextValue="name"
          itemComponent={(props) => (
            <SelectItem item={props.item}>
              {props.item.rawValue.name}
            </SelectItem>
          )}
        >
          <SelectTrigger aria-label="Page">
            <SelectValue<Page>>
              {(state) => state.selectedOption().name}
            </SelectValue>
          </SelectTrigger>
          <SelectContent />
        </Select>
        <Tabs
          class="hidden sm:flex justify-self-center"
          defaultValue={currentPage().path}
          onChange={(value) => navigate({ to: value })}
        >
          <TabsList class="flex gap-2 w-full">
            <For each={filteredPages()}>
              {(page) => (
                <TabsTrigger value={page.path}>{page.name}</TabsTrigger>
              )}
            </For>
          </TabsList>
        </Tabs>
      </div>

      <Outlet />
    </main>
  )
}
