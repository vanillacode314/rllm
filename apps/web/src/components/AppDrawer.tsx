import { createSignal, type JSXElement, onCleanup, onMount, Show } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Dynamic, Portal } from 'solid-js/web';

import { ChatListSection, QuickActionsSection } from './ChatList';
import { Button } from './ui/button';
import { Drawer, DrawerClose, DrawerContent } from './ui/drawer';
import { Separator } from './ui/separator';

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
  open: false,
  Comp: null
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
      <DrawerContent class="p-4 flex flex-col gap-4">
        <DrawerClose as={Button<'button'>} variant="outline">
          <span class="icon-[heroicons--x-mark-16-solid]" />
          <span>Close</span>
        </DrawerClose>
        <div class="max-h-[60vh] overflow-y-auto" ref={setScrollRef}>
          <Show
            fallback={
              <div class="space-y-4">
                <QuickActionsSection onClose={() => setState('open', false)} />
                <Separator />
                <ChatListSection
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
            ></Dynamic>
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
    isOpen: () => state.open,
    open: () => setState('open', true),
    close: () => setState('open', false),
    toggle: () => setState('open', (value) => !value),
    setContent: (Comp: AppDrawerComponent) => {
      onMount(() => setState('Comp', () => Comp));
      onCleanup(() => setState('Comp', null));
    }
  };
}

export default AppDrawer;
