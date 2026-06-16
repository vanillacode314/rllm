import { createWritableMemo } from '@solid-primitives/memo';
import { useLocation } from '@tanstack/solid-router';

import type { AppDrawerComponentProps } from '~/components/AppDrawer';

import { ChatListSection, QuickActionsSection } from '~/components/ChatList';
import ChatSettingsControls from '~/components/ChatSettingsControls';
import { Separator } from '~/components/ui/separator';
import { type TChatSettings, updateChatSettings } from '~/lib/chat/settings';
import { produce } from '~/utils/immer';

import { chatSettings } from './-state';

export function ChatAppDrawer(props: AppDrawerComponentProps) {
  const location = useLocation();

  const [localSettings, setLocalSettings] = createWritableMemo(() => chatSettings());

  props.onClose(() => {
    const settings = chatSettings()
      .zip(localSettings())
      .mapOr(null, ([chat, local]) => ({ chat, local }));
    if (!settings) {
      console.warn('No settings to save');
      return;
    }
    const hasUnsavedChanges = JSON.stringify(settings.local) !== JSON.stringify(settings.chat);
    if (hasUnsavedChanges) updateChatSettings(settings.local, location());
  });

  function updateLocalSettings(fn: (settings: TChatSettings) => void) {
    return setLocalSettings((localSettings) =>
      localSettings.map((localSettings) =>
        produce(localSettings, (localSettings) => void fn(localSettings))
      )
    );
  }

  return (
    <div class="flex flex-col gap-4">
      <ChatSettingsControls
        class="p-4 pb-0"
        onApplyPreset={(preset) => {
          updateLocalSettings((settings) => {
            Object.assign(settings, preset.settings);
          });
        }}
        onIncludeDateTimeChange={(checked) =>
          updateLocalSettings((settings) => {
            settings.includeDateTimeInSystemPrompt = checked;
          })
        }
        onModelChange={(model) =>
          updateLocalSettings((settings) => {
            settings.modelId = model.id;
          })
        }
        onProviderChange={(provider) =>
          updateLocalSettings((settings) => {
            settings.providerId = provider.id;
            settings.modelId = provider.defaultModelIds[0];
          })
        }
        onReasoningChange={(reasoning) =>
          updateLocalSettings((settings) => {
            settings.reasoning = reasoning;
          })
        }
        onSystemPromptChange={(systemPrompt) =>
          updateLocalSettings((settings) => {
            settings.systemPrompt = systemPrompt;
          })
        }
        settings={localSettings().unwrapOr({
          includeDateTimeInSystemPrompt: true,
          modelId: '',
          providerId: '',
          reasoning: 'medium' as TChatSettings['reasoning'],
          systemPrompt: ''
        })}
      />
      <Separator />
      <QuickActionsSection class="px-4" onClose={props.close} />
      <Separator />
      <ChatListSection class="p-4 pt-0" onClose={props.close} showGroupLabel sizePx={720} />
    </div>
  );
}

export default ChatAppDrawer;
