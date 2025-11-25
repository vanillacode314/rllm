import type { TUpdate } from 'event-logger';

import { type } from 'arktype';
import { getTableName } from 'drizzle-orm';
import { safeParseJson } from 'ts-result-option/utils';
import { Type } from 'typebox';

import {
	chatsSchema,
	mcpsSchema,
	providersSchema,
	tables,
	userMetadataSchema
} from '~/db/app-schema';
import { maybeJson } from '~/utils/arktype';

export const ValidMessage = Type.Script(`{
    type: "add_mcp" | "update_mcp" | "add_provider" | "update_provider" | "create_chat" | "update_chat" | "delete_mcp" | "delete_chat" | "delete_provider" | "set_user_metadata",
    data: Record<string, unknown>
  }`);
const validMessage = type({
	type: '"add_provider"',
	data: maybeJson(providersSchema.omit('createdAt', 'updatedAt'))
})
	.or({
		type: '"update_provider"',
		data: maybeJson(
			providersSchema
				.omit('createdAt', 'updatedAt')
				.partial()
				.merge({ id: providersSchema.get('id') })
		)
	})
	.or({
		type: '"add_mcp"',
		data: maybeJson(mcpsSchema.omit('createdAt', 'updatedAt'))
	})
	.or({
		type: '"update_mcp"',
		data: maybeJson(
			mcpsSchema
				.omit('createdAt', 'updatedAt')
				.partial()
				.merge({ id: mcpsSchema.get('id') })
		)
	})
	.or({
		type: '"create_chat"',
		data: maybeJson(
			chatsSchema.omit('createdAt', 'updatedAt').merge({
				finished: 'boolean = true',
				tags: type('string[]').default(() => [])
			})
		)
	})
	.or({
		type: '"update_chat"',
		data: maybeJson(
			chatsSchema
				.omit('createdAt', 'updatedAt')
				.merge({
					finished: 'boolean = true',
					tags: type('string[]').default(() => [])
				})
				.partial()
				.merge({ id: chatsSchema.get('id') })
		)
	})
	.or({
		type: '"delete_mcp" | "delete_chat" | "delete_provider"',
		data: type({ id: 'string' }).or(
			type('string').pipe((value) => {
				return safeParseJson(value, { validate: type({ id: 'string' }).assert }).mapOr(
					value,
					(value) => value.id
				);
			})
		)
	})
	.or({
		type: '"set_user_metadata"',
		data: maybeJson(userMetadataSchema.omit('createdAt', 'updatedAt'))
	});

type TValidMessage = typeof validMessage.infer;

const userIntentToTable = new Map(
	Object.entries({
		add_mcp: tables.mcps,
		add_provider: tables.providers,
		create_chat: tables.chats,
		delete_chat: tables.chats,
		delete_mcp: tables.mcps,
		delete_provider: tables.providers,
		set_user_metadata: tables.userMetadata,
		update_chat: tables.chats,
		update_mcp: tables.mcps,
		update_provider: tables.providers
	})
);

const processMessage = async (value: TValidMessage): Promise<TUpdate[]> => {
	const table = userIntentToTable.get(value.type)!;
	const tableName = getTableName(table);
	switch (value.type) {
		case 'add_mcp':
		case 'add_provider':
		case 'create_chat': {
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
		case 'delete_chat':
		case 'delete_mcp':
		case 'delete_provider': {
			const id = value.data;
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
		case 'set_user_metadata': {
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
		case 'update_chat':
		case 'update_mcp':
		case 'update_provider': {
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

export { processMessage, validMessage };
export type { TValidMessage };
