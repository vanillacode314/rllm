import { ColorModeProvider, cookieStorageManager } from '@kobalte/core';
import { makePersisted } from '@solid-primitives/storage';
import { debounce } from '@tanstack/solid-pacer';
import { QueryClientProvider } from '@tanstack/solid-query';
// import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/solid-router';
import { createSignal, For, type JSXElement, onMount, Suspense } from 'solid-js';
import { Option } from 'ts-result-option';
import { Button } from 'ui/button';
import { SidebarProvider } from 'ui/sidebar';
import { Toaster } from 'ui/sonner';

import AppDrawer from '~/components/AppDrawer';
import TheChatSettingsDrawer from '~/components/TheChatSettingsDrawer';
import TheCommandPrompt from '~/components/TheCommandPrompt';
import TheSidebar from '~/components/TheSidebar';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { logger } from '~/db/client';
import { dbStorage, scratchpadStorage } from '~/lib/chat/generation/storages';
import { retryFailedTitleAndTags } from '~/lib/chat/tasks';
import { MCPManager } from '~/lib/mcp/manager';
import { ProxyManager } from '~/lib/proxy';
import { fetchers } from '~/queries';
import { account } from '~/signals/account';
import { PeerManager } from '~/sockets/transports';
import { syncColorMode } from '~/utils/color-mode';
import { once } from '~/utils/functions';
import { queryClient } from '~/utils/query-client';
import { clearData } from '~/utils/storage';

export const Route = createRootRouteWithContext()({
  beforeLoad: once(async () => {
    if (import.meta.env.VITE_MODE === 'android') syncColorMode();
    if ('storage' in navigator) {
      await navigator.storage.persist();
    }
    console.debug('[Finished DB Setup]');
    void import('~/lib/chat/settings').then(({ initChatSettings }) => initChatSettings());

    async function initProxyManager() {
      const proxyUrl = await fetchers.userMetadata.byId(USER_METADATA_KEYS.CORS_PROXY_URL);
      await ProxyManager.initialize(proxyUrl);
    }
    void initProxyManager().finally(() => ProxyManager.subscribe(() => MCPManager.initialize()));
    void import('~/lib/background-task-manager').then(({ BackgroundTaskManager }) =>
      BackgroundTaskManager.init()
    );

    const debouncedMcpInitialized = debounce(() => MCPManager.initialize(), { wait: 1000 });
    logger.on('updateMcp', debouncedMcpInitialized, { self: true });
    logger.on('createMcp', debouncedMcpInitialized, { self: true });
    logger.on('deleteMcp', debouncedMcpInitialized, { self: true });

    async function initChatGenerationManager() {
      const { ChatGenerationManager } = await import('~/lib/chat/generation');
      ChatGenerationManager.registerStorage(dbStorage);
      ChatGenerationManager.registerStorage(scratchpadStorage);
    }
    void initChatGenerationManager();

    setTimeout(() => void retryFailedTitleAndTags(), 1000 * 30);

    async function initTransports() {
      const accountId = Option.from(account()).map((account) => account.id);
      if (accountId.isSome()) {
        const clientId = Option.from(await logger.getMetadata('clientId'))
          .okOrElse(() => new Error('Missing clientId in local database metadata'))
          .unwrap();
        const { initWebsocketTransport } = await import('~/sockets/transports/websocket');
        void initWebsocketTransport().catch((err) =>
          console.error(new Error('Failed to init websocket transport', { cause: err }))
        );
        const { webRTCTransportFactory } = await import('~/sockets/transports/webrtc');
        PeerManager.registerTransport(webRTCTransportFactory);
        const { peerJSTransportFactory } = await import('~/sockets/transports/peerjs');
        PeerManager.registerTransport(peerJSTransportFactory(clientId));
        const { irohTransportFactory } = await import('~/sockets/transports/iroh');
        PeerManager.registerTransport(irohTransportFactory);
        void PeerManager.init(accountId.unwrap(), clientId);
      }
    }
    void initTransports();
  }),
  component: RootComponent,
  errorComponent: ErrorComponent
});

function AutoImportModals() {
  const modals = import.meta.glob('~/components/modals/auto-import/*.tsx', {
    eager: true,
    import: 'default'
  }) as Record<string, () => JSXElement>;

  return (
    <For each={Object.values(modals)}>
      {(Modal) => (
        <Suspense>
          <Modal />
        </Suspense>
      )}
    </For>
  );
}

function ErrorComponent(props: { error: unknown }) {
  onMount(() => console.error(props.error));

  return (
    <div class="grid place-content-center h-full">
      <Button
        onClick={() => {
          clearData().then(() => location.reload());
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
        <SidebarProvider
          class="h-full w-full isolate"
          onOpenChange={(value) => setSidebarOpen(value)}
          open={sidebarOpen()}
        >
          <Toaster duration={3000} position="bottom-center" />
          <Suspense>
            <TheSidebar />
          </Suspense>
          <Suspense>
            <TheCommandPrompt />
          </Suspense>
          <Outlet />
          <Suspense>
            <AppDrawer />
          </Suspense>
          <Suspense>
            <TheChatSettingsDrawer />
          </Suspense>
          <AutoImportModals />
        </SidebarProvider>

        {/* <SolidQueryDevtools initialIsOpen={false} /> */}
      </QueryClientProvider>
      {/* <Suspense> */}
      {/*   <TanStackRouterDevtools /> */}
      {/* </Suspense> */}
    </ColorModeProvider>
  );
}
