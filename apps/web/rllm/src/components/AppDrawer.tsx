import { createSignal, type JSXElement, onCleanup, onMount, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Dynamic, Portal } from 'solid-js/web';

import { ChatListSection, QuickActionsSection } from './ChatList';
import { Button } from 'ui/button';
import { Drawer, DrawerClose, DrawerContent } from 'ui/drawer';
import { Separator } from 'ui/separator';

export type AppDrawerComponent = (props: AppDrawerComponentProps) => JSXElement;
export type AppDrawerComponentProps = {
  close: () => void;
  onClose: (fn: () => void) => void;
  scrollRef: HTMLDivElement | null;
};

const [state, setState] = createStore<{
  Comp: AppDrawerComponent | null;
  open: boolean;
}>({
  Comp: null,
  open: false
});

export function AppDrawer() {
  const [scrollRef, setScrollRef] = createSignal<HTMLDivElement | null>(null);

  return (
    <Drawer
      closeOnOutsidePointer={false}
      initialFocusEl={document.body}
      onOpenChange={(value) => setState('open', value)}
      open={state.open}
      side="bottom"
    >
      <DrawerContent class="flex flex-col">
        <div class="p-4 pb-0 grid">
          <DrawerClose as={Button<'button'>} variant="outline">
            <span class="icon-[heroicons--x-mark-16-solid]" />
            <span>Close</span>
          </DrawerClose>
        </div>
        <div class="max-h-[60vh] overflow-y-auto" ref={setScrollRef}>
          <Show
            fallback={
              <div class="space-y-4">
                <QuickActionsSection class="p-4 pb-0" onClose={() => setState('open', false)} />
                <Separator />
                <ChatListSection
                  class="p-4 pt-0"
                  onClose={() => setState('open', false)}
                  showGroupLabel
                  sizePx={720}
                />
              </div>
            }
            when={state.Comp}
          >
            <Dynamic
              close={() => setState('open', false)}
              component={state.Comp!}
              onClose={(fn: () => void) => onCleanup(fn)}
              scrollRef={scrollRef()}
            />
          </Show>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function AppDrawerFab() {
  return (
    <Portal>
      <Button
        class="fixed bottom-4 right-4 z-10 bg-primary/10 backdrop-blur-xl md:hidden"
        onClick={() => setState('open', true)}
        size="icon"
        variant="outline"
      >
        <span class="icon-[heroicons--bars-3-16-solid]" />
      </Button>
    </Portal>
  );
}

export function useAppDrawer() {
  return {
    close: () => setState('open', false),
    isOpen: () => state.open,
    open: () => setState('open', true),
    setContent: (Comp: AppDrawerComponent) => {
      onMount(() => setState('Comp', () => Comp));
      onCleanup(() => setState('Comp', null));
    },
    toggle: () => setState('open', (value) => !value)
  };
}

export default AppDrawer;
