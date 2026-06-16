import { createFileRoute, redirect } from '@tanstack/solid-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ params: { _splat: 'new' }, to: '/chat/$' });
  }
});
