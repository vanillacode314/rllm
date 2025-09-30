import { createFileRoute, Outlet, redirect } from '@tanstack/solid-router'

import { fetchers, queries } from '~/queries'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'

export const Route = createFileRoute('/_chat')({
  component: Outlet,
  beforeLoad: async () => {
    const n = await fetchers.providers.countProviders()
    if (n === 0) {
      throw redirect({ to: '/settings/providers' })
    }

    const [selectedProviderId, providers, proxyUrl] = await Promise.all([
      queryClient.ensureQueryData(queries.providers.selected()),
      queryClient.ensureQueryData(queries.providers.all()),
      queryClient.ensureQueryData(queries.userMetadata.byId('cors-proxy-url')),
      queryClient.ensureQueryData(queries.models.selected()),
    ])
    await queryClient.ensureQueryData(queries.mcps.all()._ctx.clients(proxyUrl))
    if (!providers.some((provider) => provider.id === selectedProviderId)) {
      await createMessages({
        user_intent: 'set_user_metadata',
        meta: {
          id: 'selected-provider-id',
          value: providers[0].id,
        },
      })
      await Promise.all([
        queryClient.refetchQueries(queries.providers.selected()),
        queryClient.ensureQueryData(queries.providers.byId(providers[0].id)),
      ])
    } else {
      await queryClient.ensureQueryData(
        queries.providers.byId(selectedProviderId),
      )
    }
  },
})
