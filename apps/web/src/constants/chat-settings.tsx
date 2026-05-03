import type { TChatSettings } from '~/lib/chat/settings';

export const REASONING_VALUE_TO_LABEL_MAP = Object.freeze({
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Max'
});

export const FALLBACK_CHAT_SETTINGS = (defaultModelId: string, defaultProviderId: string) =>
  ({
    modelId: defaultModelId!,
    providerId: defaultProviderId!,
    systemPrompt: '',
    includeDateTimeInSystemPrompt: true,
    reasoning: 'medium'
  }) satisfies TChatSettings;
