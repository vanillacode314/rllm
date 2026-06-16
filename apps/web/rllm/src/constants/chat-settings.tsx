import type { TChatSettings } from '~/lib/chat/settings';

export const REASONING_VALUE_TO_LABEL_MAP = Object.freeze({
  high: 'High',
  low: 'Low',
  medium: 'Medium',
  minimal: 'Minimal',
  none: 'None',
  xhigh: 'Max'
});

export const FALLBACK_CHAT_SETTINGS = (defaultModelId: string, defaultProviderId: string) =>
  ({
    includeDateTimeInSystemPrompt: true,
    modelId: defaultModelId!,
    providerId: defaultProviderId!,
    reasoning: 'medium',
    systemPrompt: ''
  }) satisfies TChatSettings;
