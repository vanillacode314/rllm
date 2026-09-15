import { nanoid } from 'nanoid';

import type { TChatPreset } from '~/db/app-schema';
import { db } from '~/db/client';

import type { TChatSettings } from './settings';

export type { TChatPreset };

export async function clearDefaultPresetId(): Promise<void> {
  await db.userMetadata.deleteDefaultChatSettingsPresetId();
}

export async function createPreset(name: string, settings: TChatSettings): Promise<string> {
  const id = nanoid();
  await db.chatPresets.create({ id, name, settings });
  return id;
}

export async function deletePreset(id: string): Promise<void> {
  await db.chatPresets.delete(id);
}

export async function duplicatePreset(preset: TChatPreset): Promise<string> {
  const id = nanoid();
  const name = generateDuplicateName(preset.name, await db.chatPresets.all());
  await db.chatPresets.create({ id, name, settings: preset.settings });
  return id;
}

export async function getDefaultPresetId(): Promise<null | string> {
  return db.userMetadata.defaultChatSettingsPresetId();
}

export async function setDefaultPresetId(presetId: string): Promise<void> {
  await db.userMetadata.setDefaultChatSettingsPresetId(presetId);
}

export async function updatePreset(
  id: string,
  data: Partial<Pick<TChatPreset, 'name' | 'settings'>>
): Promise<void> {
  await db.chatPresets.update(id, { ...data });
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
