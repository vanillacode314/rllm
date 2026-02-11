import type { Transaction } from 'sqlocal';

import { asc, count, inArray } from 'drizzle-orm';
import { type AsyncResult, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import type { TEvent } from '~/db/schema';

import { db } from '~/db/client';
import { tables } from '~/db/schema';
import { type TValidMessage } from '~/queries/mutations';

import { withTransaction } from './db';

type TOptimizationState = {
	alreadySetUserMetadataKeys: Set<string>;
	alreadyUpdatedChatIds: Set<string>;
	alreadyUpdatedMCPIds: Set<string>;
	alreadyUpdatedProviderIds: Set<string>;
	deletedChatIds: Set<string>;
	deletedMCPIds: Set<string>;
	deletedProviderIds: Set<string>;
	messagesToDelete: Set<string>;
};
async function optimizeMessages<T extends TEvent>(messages: T[]): Promise<T[]> {
	const state = await produceMessagesOptimizationState(messages);
	return messages.filter((message) => !state.messagesToDelete.has(message.timestamp));
}

const optimizeStorage = ({
	tx,
	tail = Number.POSITIVE_INFINITY
}: {
	tail?: number;
	tx?: Transaction;
} = {}): AsyncResult<void, Error> =>
	tryBlock<void, Error>(
		async function* () {
			if (!tx) {
				yield* withTransaction((tx) => optimizeStorage({ tx, tail }));
				await db.run('VACUUM;');
				return Result.Ok();
			}

			const total = await tx
				.query(db.select({ count: count() }).from(tables.events))
				.then((rows) => rows[0].count);
			let query = db.select().from(tables.events).orderBy(asc(tables.events.timestamp)).$dynamic();
			if (tail !== Number.POSITIVE_INFINITY && tail < total)
				query = query.offset(total - tail).limit(tail);

			const messages = await tx.query(query);
			const state = await produceMessagesOptimizationState(messages);
			console.debug('[Optimize Storage] Redundant messages to delete', state.messagesToDelete.size);

			await tx.query(
				db
					.delete(tables.events)
					.where(inArray(tables.events.timestamp, state.messagesToDelete.values().toArray()))
			);
			return Result.Ok();
		},
		(e) => new Error(`Failed to optimize storage`, { cause: e })
	);

async function produceMessagesOptimizationState(events: TEvent[]): Promise<TOptimizationState> {
	const state = {
		deletedChatIds: new Set<string>(),
		deletedProviderIds: new Set<string>(),
		deletedMCPIds: new Set<string>(),
		alreadyUpdatedChatIds: new Set<string>(),
		alreadyUpdatedProviderIds: new Set<string>(),
		alreadyUpdatedMCPIds: new Set<string>(),
		alreadySetUserMetadataKeys: new Set<string>(),
		messagesToDelete: new Set<string>()
	};
	for (let i = events.length; i > 0; i--) {
		const event = events[i - 1];
		switch (event.type) {
			case 'add_mcp': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const mcpId = typesafeEvent.data.id;
				if (mcpId === undefined) break;
				if (state.deletedMCPIds.has(mcpId)) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadyUpdatedMCPIds.add(mcpId);
				break;
			}
			case 'add_provider': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const providerId = typesafeEvent.data.id;
				if (providerId === undefined) break;
				if (state.deletedProviderIds.has(providerId)) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadyUpdatedProviderIds.add(providerId);
				break;
			}
			case 'create_chat': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const chatId = typesafeEvent.data.id;
				if (chatId === undefined) break;
				if (state.deletedChatIds.has(chatId)) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadyUpdatedChatIds.add(chatId);
				break;
			}
			case 'delete_chat': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const chatId = typesafeEvent.data.id;
				state.deletedChatIds.add(chatId);
				break;
			}
			case 'delete_mcp': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const mcpId = typesafeEvent.data.id;
				state.deletedMCPIds.add(mcpId);
				break;
			}
			case 'delete_provider': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const providerId = typesafeEvent.data.id;
				state.deletedProviderIds.add(providerId);
				break;
			}
			case 'set_user_metadata': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const key = typesafeEvent.data.id;
				if (state.alreadySetUserMetadataKeys.has(key)) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadySetUserMetadataKeys.add(key);
				break;
			}
			case 'update_chat': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const chatId = typesafeEvent.data.id;
				if (chatId === undefined) break;
				if (state.deletedChatIds.has(chatId) || state.alreadyUpdatedChatIds.has(chatId)) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadyUpdatedChatIds.add(chatId);
				break;
			}

			case 'update_mcp': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const mcpId = typesafeEvent.data.id;
				if (mcpId === undefined) break;
				if (state.deletedMCPIds.has(mcpId) || state.alreadyUpdatedMCPIds.has(mcpId)) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadyUpdatedMCPIds.add(mcpId);
				break;
			}
			case 'update_provider': {
				const typesafeEvent = event as unknown as TValidMessage & {
					type: typeof event.type;
				};
				const providerId = typesafeEvent.data.id;
				if (providerId === undefined) break;
				if (
					state.deletedProviderIds.has(providerId) ||
					state.alreadyUpdatedProviderIds.has(providerId)
				) {
					state.messagesToDelete.add(event.timestamp);
					break;
				}
				state.alreadyUpdatedProviderIds.add(providerId);
				break;
			}
			default: {
				break;
			}
		}
	}
	return state;
}

export { optimizeMessages, optimizeStorage, produceMessagesOptimizationState };
