import type { TUpdate } from 'event-logger';

import { getTableName } from 'drizzle-orm';
import { z } from 'zod';

import { tables } from '~/db/app-schema';

export const ValidEvent = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('createMcp'),
		data: z.object({
			id: z.string(),
			name: z.string(),
			url: z.string()
		})
	}),
	z.object({
		type: z.literal('updateMcp'),
		data: z.object({
			id: z.string(),
			name: z.string().optional(),
			url: z.string().optional()
		})
	}),
	z.object({
		type: z.literal('deleteMcp'),
		data: z.object({
			id: z.string()
		})
	}),
	z.object({
		type: z.literal('createProvider'),
		data: z.object({
			id: z.string(),
			name: z.string(),
			type: z.literal('openai'),
			baseUrl: z.string(),
			token: z.string(),
			defaultModelIds: z.array(z.string())
		})
	}),
	z.object({
		type: z.literal('updateProvider'),
		data: z.object({
			id: z.string(),
			name: z.string().optional(),
			type: z.literal('openai').optional(),
			baseUrl: z.string().optional(),
			token: z.string().optional(),
			defaultModelIds: z.array(z.string()).optional()
		})
	}),
	z.object({
		type: z.literal('deleteProvider'),
		data: z.object({
			id: z.string()
		})
	}),
	z.object({
		type: z.literal('createChat'),
		data: z.object({
			id: z.string(),
			title: z.string(),
			tags: z.array(z.string()).optional(),
			finished: z.boolean().optional(),
			messages: z.looseObject({}),
			settings: z.looseObject({})
		})
	}),
	z.object({
		type: z.literal('updateChat'),
		data: z.object({
			id: z.string(),
			title: z.string().optional(),
			tags: z.array(z.string()).optional(),
			finished: z.boolean().optional(),
			messages: z.looseObject({}).optional(),
			settings: z.looseObject({}).optional()
		})
	}),
	z.object({
		type: z.literal('deleteChat'),
		data: z.object({
			id: z.string()
		})
	}),
	z.object({
		type: z.literal('setUserMetadata'),
		data: z.object({
			id: z.string(),
			value: z.string()
		})
	}),
	z.object({
		type: z.literal('createPreset'),
		data: z.object({
			id: z.string(),
			name: z.string(),
			settings: z.looseObject({})
		})
	}),
	z.object({
		type: z.literal('updatePreset'),
		data: z.object({
			id: z.string(),
			name: z.string().optional(),
			settings: z.looseObject({}).optional()
		})
	}),
	z.object({
		type: z.literal('deletePreset'),
		data: z.object({
			id: z.string()
		})
	})
]);

export type TValidEvent = z.infer<typeof ValidEvent>;

const userIntentToTable = new Map(
	Object.entries({
		createMcp: tables.mcps,
		createProvider: tables.providers,
		createChat: tables.chats,
		createPreset: tables.chatPresets,
		deleteChat: tables.chats,
		deleteMcp: tables.mcps,
		deleteProvider: tables.providers,
		deletePreset: tables.chatPresets,
		setUserMetadata: tables.userMetadata,
		updateChat: tables.chats,
		updateMcp: tables.mcps,
		updatePreset: tables.chatPresets,
		updateProvider: tables.providers
	})
);

export const processMessage = async (value: TValidEvent): Promise<TUpdate[]> => {
	const table = userIntentToTable.get(value.type)!;
	const tableName = getTableName(table);
	switch (value.type) {
		case 'createChat':
		case 'createMcp':
		case 'createPreset':
		case 'createProvider': {
			return [
				{
					operation: 'insert',
					table: tableName,
					id: value.data.id,
					data: value.data,
					invalidate: [
						['db', tableName, 'all'],
						['db', tableName, 'byId', value.data.id]
					]
				}
			];
		}
		case 'deleteChat':
		case 'deleteMcp':
		case 'deletePreset':
		case 'deleteProvider': {
			const id = value.data.id;
			return [
				{
					operation: 'delete',
					table: tableName,
					id,
					invalidate: [
						['db', tableName, 'all'],
						['db', tableName, 'byId', id]
					]
				}
			];
		}
		case 'setUserMetadata': {
			return [
				{
					operation: 'upsert',
					table: tableName,
					id: value.data.id,
					data: value.data,
					invalidate: [
						['db', 'userMetadata', 'all'],
						['db', 'userMetadata', 'byId', value.data.id]
					]
				}
			];
		}
		case 'updateChat':
		case 'updateMcp':
		case 'updatePreset':
		case 'updateProvider': {
			return [
				{
					operation: 'update',
					table: tableName,
					id: value.data.id,
					data: value.data,
					invalidate: [
						['db', tableName, 'all'],
						['db', tableName, 'byId', value.data.id]
					]
				}
			];
		}
	}
};
