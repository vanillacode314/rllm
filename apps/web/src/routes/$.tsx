import { createFileRoute, redirect } from '@tanstack/solid-router';

export const Route = createFileRoute('/$')({
	beforeLoad: ({ location }) => {
		if (location.pathname === '/') throw new Error('Should not be possible');
		throw redirect({ to: '/' });
	}
});
