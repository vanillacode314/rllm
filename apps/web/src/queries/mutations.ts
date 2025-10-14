import type { TUpdate } from 'event-logger';

import { getTableName } from 'drizzle-orm';
import { Type } from 'typebox';

import { tables } from '~/db/app-schema';

const BaseEvent = Type.Object({
	timestamp: Type.String(),
	version: Type.Optional(Type.String())
});

export const ValidEvent = Type.Union([
	Type.Intersect([
		Type.Object({
			type: Type.Literal('createMcp'),
			data: Type.Object({
				id: Type.String(),
				name: Type.String(),
				url: Type.String()
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('updateMcp'),
			data: Type.Object({
				id: Type.String(),
				name: Type.Optional(Type.String()),
				url: Type.Optional(Type.String())
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('deleteMcp'),
			data: Type.Object({
				id: Type.String()
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('createProvider'),
			data: Type.Object({
				id: Type.String(),
				name: Type.String(),
				type: Type.Literal('openai'),
				baseUrl: Type.String(),
				token: Type.String(),
				defaultModelIds: Type.Array(Type.String())
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('updateProvider'),
			data: Type.Object({
				id: Type.String(),
				name: Type.Optional(Type.String()),
				type: Type.Optional(Type.Literal('openai')),
				baseUrl: Type.Optional(Type.String()),
				token: Type.Optional(Type.String()),
				defaultModelIds: Type.Optional(Type.Array(Type.String()))
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('deleteProvider'),
			data: Type.Object({
				id: Type.String()
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('createChat'),
			data: Type.Object({
				id: Type.String(),
				title: Type.String(),
				tags: Type.Optional(Type.Array(Type.String())),
				finished: Type.Optional(Type.Boolean()),
				messages: Type.Object({}),
				settings: Type.Object({})
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('updateChat'),
			data: Type.Object({
				id: Type.String(),
				title: Type.Optional(Type.String()),
				tags: Type.Optional(Type.Array(Type.String())),
				finished: Type.Optional(Type.Boolean()),
				messages: Type.Optional(Type.Object({})),
				settings: Type.Optional(Type.Object({}))
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('deleteChat'),
			data: Type.Object({
				id: Type.String()
			})
		}),
		BaseEvent
	]),
	Type.Intersect([
		Type.Object({
			type: Type.Literal('setUserMetadata'),
			data: Type.Object({
				id: Type.String(),
				value: Type.String()
			})
		}),
		BaseEvent
	])
]);

export type TValidEvent = Type.Static<typeof ValidEvent>;

const userIntentToTable = new Map(
	Object.entries({
		createMcp: tables.mcps,
		createProvider: tables.providers,
		createChat: tables.chats,
		deleteChat: tables.chats,
		deleteMcp: tables.mcps,
		deleteProvider: tables.providers,
		setUserMetadata: tables.userMetadata,
		updateChat: tables.chats,
		updateMcp: tables.mcps,
		updateProvider: tables.providers
	})
);

export const processMessage = async (value: TValidEvent): Promise<TUpdate[]> => {
	const table = userIntentToTable.get(value.type)!;
	const tableName = getTableName(table);
	switch (value.type) {
		case 'createChat':
		case 'createMcp':
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
