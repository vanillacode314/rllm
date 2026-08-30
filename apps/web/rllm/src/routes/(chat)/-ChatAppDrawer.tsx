import { createWritableMemo } from '~/utils/signals';
import { Separator } from 'ui/separator';

import type { AppDrawerComponentProps } from '~/components/AppDrawer';

import { ChatListSection, QuickActionsSection } from '~/components/ChatList';
import ChatSettingsControls from '~/components/ChatSettingsControls';
import { type TChatSettings, saveChatSettings } from '~/lib/chat/settings';
import { produce } from '~/utils/immer';

import { chatState } from './-state';
import { useChatState } from '~/context/chat';

export function ChatAppDrawer(props: AppDrawerComponentProps) {
  // oxlint-disable-next-line solid/reactivity
  const { onClose } = props;

  const [localSettings, setLocalSettings] = createWritableMemo(() => chatState.settings);
  const chatRouteState = useChatState();

  onClose(() => {
    const settings = chatState.settings
      .zip(localSettings())
      .mapOr(null, ([chat, local]) => ({ chat, local }));
    if (!settings) {
      console.warn('No settings to save');
      return;
    }
    const hasUnsavedChanges = JSON.stringify(settings.local) !== JSON.stringify(settings.chat);
    if (hasUnsavedChanges)
      saveChatSettings(settings.local, {
        chatId: chatRouteState.currentChatId,
        scratchpad: chatRouteState.isScratchpadRoute
      });
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
