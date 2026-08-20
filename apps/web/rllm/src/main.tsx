import { Keyboard } from '@capacitor/keyboard';
import { createRouter, RouterProvider, type ErrorComponentProps } from '@tanstack/solid-router';
import 'katex/dist/katex.css';

import './styles.css';
// import './styles/starry-night/vscode-dark.css';
import 'highlight.js/styles/dark.css';
import { onMount } from 'solid-js';
import { render } from 'solid-js/web';
import 'virtual:uno.css';
import { toast } from 'solid-sonner';

import { routeTree } from './routeTree.gen';
import { Callout, CalloutContent, CalloutTitle } from 'ui/callout';
import { Button } from 'ui/button';

const router = createRouter({
  defaultGcTime: 0,
  defaultPendingComponent: import.meta.env.DEV
    ? () => <div class="bg-red-600 inset-0 w-full h-full z-50">Loading...</div>
    : () => (
        <div class="grid place-content-center inset-0 fixed p-8 text-5xl w-full h-full z-50">
          <span class="icon-[svg-spinners--180-ring-with-bg]" />
        </div>
      ),
  defaultViewTransition: true,
  routeTree,
  scrollRestoration: true,
  defaultErrorComponent: ErrorComponent
});

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}

function ErrorComponent(props: ErrorComponentProps) {
  onMount(() => console.error(props.error));

  return (
    <div class="grid place-content-center h-full w-full gap-4">
      <Callout variant="error" class="min-w-75">
        <CalloutTitle>An Error Occurred</CalloutTitle>
        <CalloutContent>{props.error.message.trim() || 'Unknown error'}</CalloutContent>
      </Callout>
      <Button onClick={() => location.reload()}>Refresh</Button>
    </div>
  );
}
function App() {
  if (import.meta.env.VITE_MODE === 'web') {
    onMount(() => {
      void setupServiceWorker();
    });
  }
  if (import.meta.env.VITE_MODE === 'android') {
    onMount(() => {
      Keyboard.addListener('keyboardWillShow', (info) => {
        const { keyboardHeight } = info;
        document.documentElement.style.setProperty('--keyboard-offset', keyboardHeight + 'px');
      });
      Keyboard.addListener('keyboardWillHide', () => {
        document.documentElement.style.removeProperty('--keyboard-offset');
      });
    });
  }

  return (
    <>
      <RouterProvider router={router} />
    </>
  );
}

const rootElement = document.getElementById('app')!;
if (!rootElement.innerHTML) {
  render(() => <App />, rootElement);
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  const { getSerwist } = await import('virtual:serwist');
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
