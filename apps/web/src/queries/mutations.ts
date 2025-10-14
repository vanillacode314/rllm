import type { Transaction } from 'sqlocal';

import { type } from 'arktype';
import { getTableName } from 'drizzle-orm';

import type { TUpdate } from '~/utils/messages';

import * as schema from '~/db/schema';

const validMessage = type({
	user_intent: '"add_provider" | "update_provider"',
	meta: schema.providersSchema.omit('createdAt', 'updatedAt')
})
	.or({
		user_intent: '"add_mcp" | "update_mcp"',
		meta: schema.mcpsSchema.omit('createdAt', 'updatedAt')
	})
	.or({
		user_intent: '"create_chat" | "update_chat"',
		meta: schema.chatsSchema.omit('createdAt', 'updatedAt').merge({
			finished: 'boolean = true',
			tags: type('string[]').default(() => [])
		})
	})
	.or({
		user_intent: '"delete_mcp" | "delete_chat" | "delete_provider"',
		meta: {
			id: 'string'
		}
	})
	.or({
		user_intent: '"set_user_metadata"',
		meta: schema.userMetadataSchema.omit('createdAt', 'updatedAt')
	});

type TValidMessage = typeof validMessage.infer;

const userIntentToTable = new Map(
	Object.entries({
		add_mcp: schema.mcps,
		add_provider: schema.providers,
		create_chat: schema.chats,
		delete_chat: schema.chats,
		delete_mcp: schema.mcps,
		delete_provider: schema.providers,
		set_user_metadata: schema.userMetadata,
		update_chat: schema.chats,
		update_mcp: schema.mcps,
		update_provider: schema.providers
	})
);

const processMessage = async (
	value: TValidMessage,
	opts: { tx?: Transaction } = {}
): Promise<TUpdate[]> => {
	switch (value.user_intent) {
		case 'add_mcp':
		case 'add_provider':
		case 'create_chat': {
			const table = userIntentToTable.get(value.user_intent)!;
			const tableName = getTableName(table);
			return [
				{
					operation: 'insert',
					table,
					id: value.meta.id,
					data: value.meta,
					invalidate: [
						['db', tableName, 'all'],
						['db', tableName, 'byId', value.meta.id]
					]
				}
			];
		}
		case 'delete_chat':
		case 'delete_mcp':
		case 'delete_provider': {
			const table = userIntentToTable.get(value.user_intent)!;
			const tableName = getTableName(table);
			return [
				{
					operation: 'delete',
					table,
					id: value.meta.id,
					invalidate: [
						['db', tableName, 'all'],
						['db', tableName, 'byId', value.meta.id]
					]
				}
			];
		}
		case 'set_user_metadata': {
			return [
				{
					operation: 'upsert',
					table: schema.userMetadata,
					id: value.meta.id,
					data: value.meta,
					invalidate: [
						['db', 'userMetadata', 'all'],
						['db', 'userMetadata', 'byId', value.meta.id]
					]
				}
			];
		}
		case 'update_chat':
		case 'update_mcp':
		case 'update_provider': {
			const table = userIntentToTable.get(value.user_intent)!;
			const tableName = getTableName(table);
			return [
				{
					operation: 'upsert',
					table,
					id: value.meta.id,
					data: value.meta,
					invalidate: [
						['db', tableName, 'all'],
						['db', tableName, 'byId', value.meta.id]
					]
				}
			];
		}
	}
};

export { processMessage, validMessage };
export type { TValidMessage };
