import type { Transaction } from 'sqlocal';

import { asc, count, inArray } from 'drizzle-orm';
import { type AsyncResult, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import type { TEvent } from '~/db/schema';

import { db } from '~/db/client';
import * as schema from '~/db/schema';
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
				.query(db.select({ count: count() }).from(schema.events))
				.then((rows) => rows[0].count);
			let query = db.select().from(schema.events).orderBy(asc(schema.events.timestamp)).$dynamic();
			if (tail !== Number.POSITIVE_INFINITY && tail < total)
				query = query.offset(total - tail).limit(tail);

			const messages = await tx.query(query);
			const state = await produceMessagesOptimizationState(messages);
			console.debug('[Optimize Storage] Redundant messages to delete', state.messagesToDelete.size);

			await tx.query(
				db
					.delete(schema.events)
					.where(inArray(schema.events.timestamp, state.messagesToDelete.values().toArray()))
			);
			return Result.Ok();
		},
		(e) => new Error(`Failed to optimize storage`, { cause: e })
	);

async function produceMessagesOptimizationState(messages: TEvent[]): Promise<TOptimizationState> {
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
	for (let i = messages.length; i > 0; i--) {
		const message = messages[i - 1];
		switch (message.user_intent) {
			case 'add_mcp': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const mcpId = typeSafeMessage.meta.id;
				if (mcpId === undefined) break;
				if (state.deletedMCPIds.has(mcpId)) {
					state.messagesToDelete.add(message.timestamp);
					break;
				}
				state.alreadyUpdatedMCPIds.add(mcpId);
				break;
			}
			case 'add_provider': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const providerId = typeSafeMessage.meta.id;
				if (providerId === undefined) break;
				if (state.deletedProviderIds.has(providerId)) {
					state.messagesToDelete.add(message.timestamp);
					break;
				}
				state.alreadyUpdatedProviderIds.add(providerId);
				break;
			}
			case 'create_chat': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const chatId = typeSafeMessage.meta.id;
				if (chatId === undefined) break;
				if (state.deletedChatIds.has(chatId)) {
					state.messagesToDelete.add(message.timestamp);
					break;
				}
				state.alreadyUpdatedChatIds.add(chatId);
				break;
			}
			case 'delete_chat': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const chatId = typeSafeMessage.meta.id;
				state.deletedChatIds.add(chatId);
				break;
			}
			case 'delete_mcp': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const mcpId = typeSafeMessage.meta.id;
				state.deletedMCPIds.add(mcpId);
				break;
			}
			case 'delete_provider': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const providerId = typeSafeMessage.meta.id;
				state.deletedProviderIds.add(providerId);
				break;
			}
			case 'set_user_metadata': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const key = typeSafeMessage.meta.id;
				if (state.alreadySetUserMetadataKeys.has(key)) {
					state.messagesToDelete.add(message.timestamp);
					break;
				}
				state.alreadySetUserMetadataKeys.add(key);
				break;
			}
			case 'update_chat': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const chatId = typeSafeMessage.meta.id;
				if (chatId === undefined) break;
				if (state.deletedChatIds.has(chatId) || state.alreadyUpdatedChatIds.has(chatId)) {
					state.messagesToDelete.add(message.timestamp);
					break;
				}
				state.alreadyUpdatedChatIds.add(chatId);
				break;
			}

			case 'update_mcp': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const mcpId = typeSafeMessage.meta.id;
				if (mcpId === undefined) break;
				if (state.deletedMCPIds.has(mcpId) || state.alreadyUpdatedMCPIds.has(mcpId)) {
					state.messagesToDelete.add(message.timestamp);
					break;
				}
				state.alreadyUpdatedMCPIds.add(mcpId);
				break;
			}
			case 'update_provider': {
				const typeSafeMessage = message as unknown as TValidMessage & {
					user_intent: typeof message.user_intent;
				};
				const providerId = typeSafeMessage.meta.id;
				if (providerId === undefined) break;
				if (
					state.deletedProviderIds.has(providerId) ||
					state.alreadyUpdatedProviderIds.has(providerId)
				) {
					state.messagesToDelete.add(message.timestamp);
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
