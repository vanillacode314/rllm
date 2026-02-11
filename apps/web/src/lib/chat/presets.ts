import { nanoid } from 'nanoid';

import type { TChatPreset } from '~/db/app-schema';

import { logger } from '~/db/client';
import { fetchers } from '~/queries';

import type { TChatSettings } from './settings';

export type { TChatPreset };

const DEFAULT_PRESET_METADATA_ID = 'default-chat-settings-preset';

export async function clearDefaultPresetId(): Promise<void> {
	await logger.dispatch({
		type: 'setUserMetadata',
		data: {
			id: DEFAULT_PRESET_METADATA_ID,
			value: ''
		}
	});
}

export async function createPreset(name: string, settings: TChatSettings): Promise<string> {
	const id = nanoid();
	await logger.dispatch({
		type: 'createPreset',
		data: { id, name, settings }
	});
	return id;
}

export async function deletePreset(id: string): Promise<void> {
	await logger.dispatch({
		type: 'deletePreset',
		data: { id }
	});
}

export async function duplicatePreset(preset: TChatPreset): Promise<string> {
	const id = nanoid();
	const name = generateDuplicateName(preset.name, await fetchers.chatPresets.getAllPresets());
	await logger.dispatch({
		type: 'createPreset',
		data: {
			id,
			name,
			settings: preset.settings
		}
	});
	return id;
}

export async function getDefaultPresetId(): Promise<null | string> {
	return fetchers.userMetadata.byId(DEFAULT_PRESET_METADATA_ID);
}

export async function setDefaultPresetId(presetId: string): Promise<void> {
	await logger.dispatch({
		type: 'setUserMetadata',
		data: {
			id: DEFAULT_PRESET_METADATA_ID,
			value: presetId
		}
	});
}

export async function updatePreset(
	id: string,
	data: Partial<Pick<TChatPreset, 'name' | 'settings'>>
): Promise<void> {
	await logger.dispatch({
		type: 'updatePreset',
		data: {
			id,
			...data
		}
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
