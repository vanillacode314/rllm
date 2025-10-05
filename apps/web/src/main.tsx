import { createRouter, RouterProvider } from '@tanstack/solid-router'
import { render } from 'solid-js/web'

import './styles.css'
import { toast } from 'solid-sonner'

import { routeTree } from './routeTree.gen'
import { listenForWaitingServiceWorker } from './utils/service-worker'

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent() {
    return <div class="bg-red-600 inset-0 w-full h-full z-50">Loading...</div>
  },
})

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

function promptUserToRefresh(registration: ServiceWorkerRegistration) {
  toast.info('New version available!', {
    action: {
      label: 'Update',
      onClick: () =>
        registration.waiting?.postMessage({ type: 'SKIP_WAITING' }),
    },
    duration: Number.POSITIVE_INFINITY,
  })
}

async function setupApp() {
  function App() {
    return (
      <>
        <RouterProvider router={router} />
      </>
    )
  }
  const rootElement = document.getElementById('app')
  if (rootElement) {
    render(() => <App />, rootElement)
  }
  await setupServiceWorker()
}

async function setupServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      })
      console.log('SW registered: ', registration)
      await listenForWaitingServiceWorker(registration).then(
        () => {
          promptUserToRefresh(registration)

          let refreshing: boolean
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            function () {
              if (refreshing) return
              refreshing = true
              window.location.reload()
            },
          )
        },
        () => console.log('Service Worker first install'),
      )
    } catch (error) {
      console.log('SW registration failed: ', error)
    }
  }
}
setupApp()
