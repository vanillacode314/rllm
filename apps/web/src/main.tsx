import { attachDevtoolsOverlay } from '@solid-devtools/overlay';
import { createRouter, RouterProvider } from '@tanstack/solid-router';
import { onMount } from 'solid-js';
import 'katex/dist/katex.css';

import './styles.css';
// import './styles/starry-night/vscode-dark.css';
import 'highlight.js/styles/dark.css';
import { render } from 'solid-js/web';
import { toast } from 'solid-sonner';
import { getSerwist } from 'virtual:serwist';

import { routeTree } from './routeTree.gen';

const router = createRouter({
	routeTree,
	scrollRestoration: true,
	defaultPendingComponent:
		import.meta.env.DEV ?
			() => <div class="bg-red-600 inset-0 w-full h-full z-50">Loading...</div>
		:	() => (
				<div class="grid place-content-center inset-0 fixed p-8 text-5xl w-full h-full z-50">
					<span class="icon-[svg-spinners--180-ring-with-bg]" />
				</div>
			),
	defaultViewTransition: true,
	defaultGcTime: 0
});

declare module '@tanstack/solid-router' {
	interface Register {
		router: typeof router;
	}
}

function App() {
	onMount(setupServiceWorker);

	return (
		<>
			<RouterProvider router={router} />
		</>
	);
}

const rootElement = document.getElementById('app');
if (rootElement) {
	render(() => <App />, rootElement);
}

async function setupServiceWorker() {
	if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

	try {
		const serwist = await getSerwist();
		if (!serwist) {
			throw new Error('Failed to get Serwist instance');
		}
		serwist.addEventListener('waiting', () => {
			serwist.addEventListener('controlling', () => window.location.reload());

			toast.info('New version available!', {
				action: {
					label: 'Update',
					onClick: () => serwist.messageSkipWaiting()
				},
				duration: Number.POSITIVE_INFINITY
			});
		});

		void serwist?.register();
	} catch (error) {
		console.log('SW registration failed: ', error);
	}
}

// attachDevtoolsOverlay();
