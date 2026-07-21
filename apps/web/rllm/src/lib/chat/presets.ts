import { nanoid } from 'nanoid';

import type { TChatPreset } from '~/db/app-schema';

import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { logger } from '~/db/client';
import { fetchers } from '~/queries';

import type { TChatSettings } from './settings';

export type { TChatPreset };

export async function clearDefaultPresetId(): Promise<void> {
  await logger.dispatch({
    data: {
      id: USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET,
      value: ''
    },
    type: 'setUserMetadata'
  });
}

export async function createPreset(name: string, settings: TChatSettings): Promise<string> {
  const id = nanoid();
  await logger.dispatch({
    data: { id, name, settings },
    type: 'createPreset'
  });
  return id;
}

export async function deletePreset(id: string): Promise<void> {
  await logger.dispatch({
    data: { id },
    type: 'deletePreset'
  });
}

export async function duplicatePreset(preset: TChatPreset): Promise<string> {
  const id = nanoid();
  const name = generateDuplicateName(preset.name, await fetchers.chatPresets.getAllPresets());
  await logger.dispatch({
    data: {
      id,
      name,
      settings: preset.settings
    },
    type: 'createPreset'
  });
  return id;
}

export async function getDefaultPresetId(): Promise<null | string> {
  return fetchers.userMetadata.byId(USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET);
}

export async function setDefaultPresetId(presetId: string): Promise<void> {
  await logger.dispatch({
    data: {
      id: USER_METADATA_KEYS.DEFAULT_CHAT_SETTINGS_PRESET,
      value: presetId
    },
    type: 'setUserMetadata'
  });
}

export async function updatePreset(
  id: string,
  data: Partial<Pick<TChatPreset, 'name' | 'settings'>>
): Promise<void> {
  await logger.dispatch({
    data: {
      id,
      ...data
    },
    type: 'updatePreset'
  });
}

function generateDuplicateName(originalName: string, existingPresets: TChatPreset[]): string {
  const baseName = originalName.includes(' (Copy') ? originalName.split(' (Copy')[0] : originalName;

  const copies = existingPresets
    .filter((p) => p.name === baseName || p.name.startsWith(`${baseName} (Copy`))
    .map((p) => {
      const match = p.name.match(/\(Copy (\d+)\)$/);
      return match ? parseInt(match[1], 10) : 1;
    });

  const maxCopy = copies.length > 0 ? Math.max(...copies) : 0;
  return maxCopy === 0 ? `${baseName} (Copy)` : `${baseName} (Copy ${maxCopy + 1})`;
}
