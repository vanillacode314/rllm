export const USER_METADATA_KEYS = Object.freeze({
  CORS_PROXY_URL: 'cors-proxy-url',
  DEFAULT_CHAT_SETTINGS_PRESET: 'default-chat-settings-preset',
  SCRATCHPAD_CHAT: 'scratchpad-chat',
  SELECTED_MODEL_ID: 'selected-model-id',
  TITLE_GENERATION_MODEL_ID: 'title-generation-model-id',
  TITLE_GENERATION_PROVIDER_ID: 'title-generation-provider-id',
  USER_DISPLAY_NAME: 'user-display-name'
});

export type TUserMetadataKey = (typeof USER_METADATA_KEYS)[keyof typeof USER_METADATA_KEYS];
