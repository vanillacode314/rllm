import { createFileRoute, redirect } from '@tanstack/solid-router';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';

import { lastOpenedPageSchema } from '~/constants/settings';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { fetchers } from '~/queries';
import { slugify } from '~/utils/string';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const startupPage = await fetchers.userMetadata.byId(USER_METADATA_KEYS.STARTUP_PAGE);

    if (startupPage === 'last-chat') {
      const lastOpenedPage = Option.from(
        await fetchers.userMetadata.byId(USER_METADATA_KEYS.LAST_OPENED_PAGE)
      );
      const parsed = lastOpenedPage
        .andThen((value) => safeParseJson(value, { validate: lastOpenedPageSchema.parse }).ok())
        .toNull();

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
