import { nanoid } from 'nanoid';
import { z } from 'zod/mini';

import { logger } from '~/db/client';
import { openAiAdapter } from '~/lib/adapters/openai';
import { generateTitleAndTags } from '~/lib/adapters/utils';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { fetchers } from '~/queries';
import { getMessagesForPath } from '~/utils/chat';
import { Tree } from '~/utils/tree';

import { BackgroundTaskManager } from '.';

export interface TTask {
	handler: (signal: AbortSignal) => Promise<unknown> | unknown;
	id: string;
	priority: TTaskPriority;
	serialize: () => unknown;
	type: string;
}

export type TTaskPriority = 'hydrated' | 'idle' | 'immediate' | 'microtask' | 'timeout';

const ValidTask = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('generateTitleAndTags'),
		arguments: z.object({
			chatId: z.string(),
			path: z.array(z.number()),
			modelId: z.string(),
			providerId: z.string()
		})
	}),
	z.object({
		type: z.literal('startLLMGeneration'),
		arguments: z.object({
			chatId: z.string(),
			attachements: z.array(
				z.object({
					description: z.string(),
					documents: z.array(
						z.object({
							content: z.string(),
							embeddings: z.array(z.number()),
							index: z.int().check(z.minimum(0))
						})
					),
					progress: z.number().check(z.minimum(0), z.maximum(1)),
					id: z.string()
				})
			),
			path: z.array(z.number()),
			feedbackEnabled: z.boolean()
		})
	})
]);
type TValidTask = z.infer<typeof ValidTask>;

export function createTask(task: TValidTask, priority: TTaskPriority = 'idle', id?: string): TTask {
	id ??= nanoid();
	switch (task.type) {
		case 'generateTitleAndTags':
			return {
				async handler(signal) {
					const [chat, tags] = await Promise.all([
						fetchers.chats.byId(task.arguments.chatId).then((chat) => {
							if (!chat) throw new Error('Chat not found');
							return {
								...chat,
								messages: Tree.fromJSON(chat.messages)
							};
						}),
						fetchers.chats.getChatTags()
					]);
					const chunks = getMessagesForPath(task.arguments.path, chat.messages).expect(
						'Could not find messages for path'
					);
					const generated = await generateTitleAndTags({
						adapter: openAiAdapter,
						model: task.arguments.modelId,
						providerId: task.arguments.providerId,
						chunks,
						signal,
						tags
					})
						.inspectErr((e) => console.log(e))
						.unwrapOr({ title: 'Untitled Chat', tags: [] });

					await logger.dispatch({
						type: 'updateChat',
						data: { id: chat.id, title: generated.title, tags: generated.tags }
					});
				},
				id,
				priority,
				serialize: () => ({ id, priority, task }),
				type: task.type
			};
		case 'startLLMGeneration':
			return {
				async handler(signal) {
					{
						const chat = await fetchers.chats.byId(task.arguments.chatId);
						if (!chat) return;
					}
					const { chat, newPath, promise, controller } =
						await ChatGenerationManager.startGeneration(
							task.arguments.chatId,
							task.arguments.path,
							task.arguments.attachements,
							task.arguments.feedbackEnabled
						);
					signal.addEventListener('abort', () => controller.abort());
					try {
						await promise;
					} finally {
						await logger.dispatch({
							type: 'updateChat',
							data: { id: chat.id, finished: true, messages: chat.messages.toJSON() }
						});
						ChatGenerationManager.removeChat(task.arguments.chatId);

						if (chat.title === 'Untitled New Chat' && !ChatGenerationManager.isAborted(chat.id)) {
							BackgroundTaskManager.scheduleTask(
								createTask({
									type: 'generateTitleAndTags',
									arguments: {
										chatId: chat.id,
										path: newPath,
										modelId: chat.settings.modelId,
										providerId: chat.settings.providerId
									}
								})
							);
						}
					}
				},
				id,
				priority,
				serialize: () => ({
					id,
					priority,
					task
				}),
				type: task.type
			};
		default:
			throw new Error(`Unknown task type: ${task}`);
	}
}

export function deserializeTask(task: unknown): TTask {
	const result = z
		.object({
			id: z.string(),
			priority: z.union([
				z.literal('immediate'),
				z.literal('microtask'),
				z.literal('timeout'),
				z.literal('idle'),
				z.literal('hydrated')
			]),
			task: ValidTask
		})
		.safeParse(task);
	if (!result.success) throw new Error('Invalid task');
	return createTask(result.data.task, 'hydrated', result.data.id);
}
