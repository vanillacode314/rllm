import { createFileRoute, redirect } from '@tanstack/solid-router';

import { queries } from '~/queries';
import { queryClient } from '~/utils/query-client';
import { slugify } from '~/utils/string';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const startupPage = await queryClient.ensureQueryData(queries.userMetadata.startupPage());

    if (startupPage === 'last-chat') {
      const parsed = await queryClient.ensureQueryData(queries.userMetadata.lastOpenedPage());

      if (parsed?.type === 'chat') {
        throw redirect({
          params: { _splat: slugify(parsed.title) },
          search: { id: parsed.id },
          to: '/chat/$'
        });
      }

      if (parsed?.type === 'scratchpad') {
        throw redirect({ to: '/scratchpad' });
      }

      throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });
    }

    if (startupPage === 'scratchpad') {
      throw redirect({ to: '/scratchpad' });
    }

    throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });
  }
});
