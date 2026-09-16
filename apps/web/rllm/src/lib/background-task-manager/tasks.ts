import { nanoid } from 'nanoid';
import { Option } from 'ts-result-option';
import { z } from 'zod/mini';

import { db } from '~/db/client';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { generateTitleAndTags } from '~/lib/chat/utils';
import { indexFile } from '~/lib/vector-db/client.platform.common';
import { removeIndexingProgress, updateIndexingProgress } from '~/lib/vector-db/progress';
import { attachmentsSchema } from '~/types/chat';
import { getMessagesForPath } from '~/utils/chat';
import { Tree } from '~/utils/tree';

import { BackgroundTaskManager } from '.';

export interface TTask {
  handler: (signal: AbortSignal) => Promise<unknown> | unknown;
  id: string;
  priority: TTaskPriority;
  serialize: () => {
    id: string;
    priority: TTaskPriority;
    task: TValidTask;
  };
  type: string;
}

export type TTaskPriority = 'hydrated' | 'idle' | 'immediate' | 'microtask' | 'timeout';

const ValidTask = z.discriminatedUnion('type', [
  z.object({
    arguments: z.object({
      chatId: z.string(),
      modelId: z.string(),
      path: z.array(z.number()),
      providerId: z.string()
    }),
    type: z.literal('generateTitleAndTags')
  }),
  z.object({ type: z.literal('saveScratchpadChat') }),
  z.object({
    arguments: z.object({
      attachements: z.array(attachmentsSchema),
      chatId: z.string(),
      feedbackEnabled: z.boolean(),
      path: z.array(z.number()),
      retry: z._default(z.boolean(), false),
      retryToolCallIds: z._default(z.array(z.string()), []),
      scratchpad: z._default(z.boolean(), false)
    }),
    type: z.literal('startLLMGeneration')
  }),
  z.object({
    arguments: z.object({
      file: z.custom<File>((file) => file instanceof File)
    }),
    type: z.literal('indexDocument')
  })
]);
type TValidTask = z.input<typeof ValidTask>;

export function createTask(task: TValidTask, priority: TTaskPriority = 'idle', id?: string): TTask {
  id ??= nanoid();
  switch (task.type) {
    case 'generateTitleAndTags':
      return {
        async handler(signal) {
          const [chat, tags] = await Promise.all([
            db.chats.get(task.arguments.chatId).then((chat) => {
              if (!chat) throw new Error('Chat not found');
              return {
                ...chat,
                messages: Tree.fromJSON(chat.messages)
              };
            }),
            db.chats.tags()
          ]);
          const chunks = getMessagesForPath(task.arguments.path, chat.messages).expect(
            'Could not find messages for path'
          );
          const generated = await generateTitleAndTags({
            chunks,
            model: task.arguments.modelId,
            providerId: task.arguments.providerId,
            signal,
            tags
          })
            .inspectErr((e) => console.log(e))
            .unwrapOr({ tags: [], title: 'Untitled Chat' });

          await db.chats.update(chat.id, { tags: generated.tags, title: generated.title });
        },
        id,
        priority,
        serialize: () => ({ id, priority, task }),
        type: task.type
      };
    case 'indexDocument':
      return {
        async handler() {
          const { file } = task.arguments;
          updateIndexingProgress(id, file.name, 0);
          try {
            await indexFile(file, (current) => updateIndexingProgress(id, file.name, current));
          } finally {
            removeIndexingProgress(id);
          }
        },
        id,
        priority,
        serialize: () => ({ id, priority, task }),
        type: task.type
      };
    case 'saveScratchpadChat':
      return {
        async handler() {
          const chat = Option.from(await db.userMetadata.scratchpadChat());
          if (chat.isNone()) return;
          await db.createChatFromScratchpad(chat.unwrap());
          BackgroundTaskManager.scheduleTask(
            createTask({
              arguments: chat
                .map((chat) => ({
                  chatId: chat.id,
                  modelId: chat.settings.modelId,
                  path: [0],
                  providerId: chat.settings.providerId
                }))
                .unwrap(),
              type: 'generateTitleAndTags'
            })
          );
        },
        id,
        priority,
        serialize: () => ({ id, priority, task }),
        type: task.type
      };
    case 'startLLMGeneration':
      return {
        async handler(signal) {
          const { chat, controller, newPath, promise } =
            await ChatGenerationManager.startGeneration(
              task.arguments.chatId,
              task.arguments.path,
              task.arguments.attachements,
              task.arguments.feedbackEnabled,
              task.arguments.retry,
              task.arguments.retryToolCallIds
            );
          signal.addEventListener('abort', () => controller.abort());
          await promise;

          if (task.arguments.scratchpad) {
            await db.userMetadata.setScratchpadChat(chat);
            return;
          }
          await db.chats.update(chat.id, { finished: true, messages: chat.messages.toJSON() });
          if (chat.title === 'Untitled New Chat' && !ChatGenerationManager.isAborted(chat.id)) {
            BackgroundTaskManager.scheduleTask(
              createTask({
                arguments: {
                  chatId: chat.id,
                  modelId: chat.settings.modelId,
                  path: newPath,
                  providerId: chat.settings.providerId
                },
                type: 'generateTitleAndTags'
              })
            );
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
