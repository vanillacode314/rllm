import { ColorModeProvider, cookieStorageManager } from '@kobalte/core';
import { makePersisted } from '@solid-primitives/storage';
import { debounce } from '@tanstack/solid-pacer';
import { QueryClientProvider } from '@tanstack/solid-query';
// import { SolidQueryDevtools } from '@tanstack/solid-query-devtools';
import { createRootRouteWithContext, Outlet } from '@tanstack/solid-router';
import { createSignal, For, type JSXElement, onMount, Suspense } from 'solid-js';
import { Button } from 'ui/button';
import { SidebarProvider } from 'ui/sidebar';
import { Toaster } from 'ui/sonner';
import { Option } from 'ts-result-option';

import AppDrawer from '~/components/AppDrawer';
import TheChatSettingsDrawer from '~/components/TheChatSettingsDrawer';
import TheCommandPrompt from '~/components/TheCommandPrompt';
import TheSidebar from '~/components/TheSidebar';
import { logger } from '~/db/client';
import { setupDb } from '~/db/client.platform.common';
import { BackgroundTaskManager } from '~/lib/background-task-manager';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { dbStorage, scratchpadStorage } from '~/lib/chat/generation/storages';
import { initChatSettings } from '~/lib/chat/settings';
import { retryFailedTitleAndTags } from '~/lib/chat/tasks';
import { MCPManager } from '~/lib/mcp/manager';
import { ProxyManager } from '~/lib/proxy';
import { PeerManager } from '~/sockets/transports';
import { webRTCTransportFactory } from '~/sockets/transports/webrtc';
import { initWebsocketTransport } from '~/sockets/transports/websocket';
import { syncColorMode } from '~/utils/color-mode';
import { once } from '~/utils/functions';
import { queryClient } from '~/utils/query-client';
import { clearData } from '~/utils/storage';
import { account } from '~/signals/account';
import { peerJSTransportFactory } from '~/sockets/transports/peerjs';
import { irohTransportFactory } from '~/sockets/transports/iroh';

export const Route = createRootRouteWithContext()({
  beforeLoad: once(async () => {
    if (import.meta.env.VITE_MODE === 'android') syncColorMode();
    if ('storage' in navigator) {
      await navigator.storage.persist();
    }
    await setupDb(logger).unwrap();
    console.debug('[Finished DB Setup]');
    await initChatSettings();

    void ProxyManager.initialize().finally(() => void MCPManager.initialize());
    void BackgroundTaskManager.init();

    const debouncedMcpInitialized = debounce(() => MCPManager.initialize(), { wait: 1000 });
    logger.on('updateMcp', debouncedMcpInitialized, { self: true });
    logger.on('createMcp', debouncedMcpInitialized, { self: true });
    logger.on('deleteMcp', debouncedMcpInitialized, { self: true });

    ChatGenerationManager.registerStorage(dbStorage);
    ChatGenerationManager.registerStorage(scratchpadStorage);

    setTimeout(() => void retryFailedTitleAndTags(), 1000 * 30);

    const accountId = Option.from(account()).map((account) => account.id);
    if (accountId.isSome()) {
      const clientId = Option.from(await logger.getMetadata('clientId'))
        .okOrElse(() => new Error('Missing clientId in local database metadata'))
        .unwrap();
      PeerManager.registerTransport(webRTCTransportFactory);
      PeerManager.registerTransport(peerJSTransportFactory(clientId));
      PeerManager.registerTransport(irohTransportFactory);
      void PeerManager.init(accountId.unwrap(), clientId);
      void initWebsocketTransport().catch((err) =>
        console.error(new Error('Failed to init websocket transport', { cause: err }))
      );
    }
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
