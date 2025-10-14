import { ColorModeProvider, cookieStorageManager } from '@kobalte/core';
import { makePersisted } from '@solid-primitives/storage';
import { QueryClientProvider } from '@tanstack/solid-query';
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { createFileRoute, createRootRouteWithContext, Outlet } from '@tanstack/solid-router';
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools';
import { createSignal, For, type JSXElement, onMount, Suspense } from 'solid-js';

import { TheCommandPrompt } from '~/components/TheCommandPrompt';
import TheSidebar from '~/components/TheSidebar';
import { Button } from '~/components/ui/button';
import { SidebarProvider } from '~/components/ui/sidebar';
import { Toaster } from '~/components/ui/sonner';
import { NotificationsProvider } from '~/context/notifications';
import { deleteDatabaseFile, setupDb } from '~/db/client';
import { initSocket } from '~/sockets/messages';
import { once } from '~/utils/functions';
import { queryClient } from '~/utils/query-client';

export const Route = createRootRouteWithContext()({
	errorComponent: ErrorComponent,
	component: RootComponent,
	beforeLoad: once(async () => {
		await navigator.storage.persist();
		try {
			await setupDb();
			initSocket();
		} catch (error) {
			console.error('[Failed DB Setup]', error);
			throw error;
		}
		console.debug('[Finished DB Setup]');
	})
});

function AutoImportModals() {
	const modals = import.meta.glob('~/components/modals/auto-import/*.tsx', {
		eager: true,
		import: 'default'
	}) as Record<string, () => JSXElement>;

	return <For each={Object.values(modals)}>{(Modal) => <Modal />}</For>;
}

function ErrorComponent(props: { error: unknown }) {
	onMount(() => console.error(props.error));

	return (
		<div class="grid place-content-center h-full">
			<Button
				onClick={() => {
					deleteDatabaseFile().then(() => location.reload());
				}}
				type="button"
			>
				Delete Database And Refresh
			</Button>
		</div>
	);
}

function RootComponent() {
	const [sidebarOpen, setSidebarOpen] = makePersisted(createSignal<boolean>(true), {
		name: 'rllm:sidebarOpen'
	});
	return (
		<ColorModeProvider storageManager={cookieStorageManager}>
			<QueryClientProvider client={queryClient}>
				<NotificationsProvider>
					<SidebarProvider
						class="h-full w-full"
						onOpenChange={(value) => setSidebarOpen(value)}
						open={sidebarOpen()}
					>
						<Toaster duration={3000} position="bottom-center" />
						<TheSidebar />
						<TheCommandPrompt />
						<Outlet />
						<AutoImportModals />
					</SidebarProvider>
				</NotificationsProvider>
				<SolidQueryDevtools initialIsOpen={false} />
			</QueryClientProvider>
			<Suspense>
				<TanStackRouterDevtools />
			</Suspense>
		</ColorModeProvider>
	);
}
