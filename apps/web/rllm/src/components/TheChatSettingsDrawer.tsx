import { createWritableMemo } from '@solid-primitives/memo';
import { useLocation } from '@tanstack/solid-router';
import { createSignal, Show } from 'solid-js';

import { type TChatPreset } from '~/lib/chat/presets';
import { type TChatSettings, updateChatSettings } from '~/lib/chat/settings';
import { chatSettings } from '~/routes/chat/-state';
import { isMobile } from '~/signals';
import { produce } from '~/utils/immer';

import ChatSettingsControls from './ChatSettingsControls';
import { Button } from 'ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from 'ui/drawer';

const [chatSettingsDrawerOpen, setChatSettingsDrawerOpen] = createSignal(false);

function TheChatSettingsDrawer() {
  const location = useLocation();

  const [localSettings, setLocalSettings] = createWritableMemo(() => chatSettings());

  function updateLocalSettings(fn: (draft: TChatSettings) => void) {
    setLocalSettings((prev) =>
      prev.map((settings) => produce(settings, (draft) => void fn(draft)))
    );
  }

  const handleApplyPreset = (preset: TChatPreset) => {
    updateLocalSettings((draft) => {
      Object.assign(draft, preset.settings);
    });
  };

  return (
    <Drawer
      closeOnOutsidePointer={false}
      initialFocusEl={document.body}
      onOpenChange={(open) => {
        if (!open) {
          // Save on close: compare local vs global and persist if different
          const current = chatSettings();
          const local = localSettings();
          if (current.isSome() && local.isSome()) {
            if (JSON.stringify(local.unwrap()) !== JSON.stringify(current.unwrap())) {
              updateChatSettings(local.unwrap(), location());
            }
          }
        }
        setChatSettingsDrawerOpen(open);
      }}
      open={chatSettingsDrawerOpen()}
      side={isMobile() ? 'top' : 'right'}
    >
      <DrawerContent class="sm:max-w-96 sm:ml-auto sm:h-full top-0 bottom-auto rounded-t-none max-sm:rounded-b-[10px] after:bottom-full after:top-0 after:h-0 mt-0 sm:rounded-l-[10px]">
        <div class="mx-auto w-full max-xs:max-w-sm h-full flex flex-col">
          <DrawerHeader>
            <DrawerTitle>Chat Settings</DrawerTitle>
            <DrawerDescription>Set your chat preferences here.</DrawerDescription>
          </DrawerHeader>
          <div class="p-4 pb-0 grow overflow-y-auto">
            <Show when={localSettings().toUndefined()}>
              {(settings) => (
                <ChatSettingsControls
                  onApplyPreset={handleApplyPreset}
                  onIncludeDateTimeChange={(checked) =>
                    updateLocalSettings((draft) => {
                      draft.includeDateTimeInSystemPrompt = checked;
                    })
                  }
                  onModelChange={(model) =>
                    updateLocalSettings((draft) => {
                      draft.modelId = model.id;
                    })
                  }
                  onProviderChange={(provider) =>
                    updateLocalSettings((draft) => {
                      draft.providerId = provider.id;
                      draft.modelId = provider.defaultModelIds[0];
                    })
                  }
                  onReasoningChange={(reasoning) =>
                    updateLocalSettings((draft) => {
                      draft.reasoning = reasoning;
                    })
                  }
                  onSystemPromptChange={(systemPrompt) =>
                    updateLocalSettings((draft) => {
                      draft.systemPrompt = systemPrompt;
                    })
                  }
                  settings={settings()}
                />
              )}
            </Show>
          </div>
          <DrawerFooter>
            <DrawerClose as={Button<'button'>} variant="outline">
              <span class="icon-[heroicons--x-mark-16-solid]" />
              <span>Close</span>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
export { chatSettingsDrawerOpen, setChatSettingsDrawerOpen };
export default TheChatSettingsDrawer;
