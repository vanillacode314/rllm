import { nanoid } from 'nanoid';
import { Option } from 'ts-result-option';
import { safeParseJson } from 'ts-result-option/utils';
import { z } from 'zod/mini';

import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { chatsSchema } from '~/db/app-schema';
import { logger } from '~/db/client';
import { ChatGenerationManager } from '~/lib/chat/generation';
import { generateTitleAndTags } from '~/lib/chat/utils';
import { fetchers } from '~/queries';
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
      attachements: z.array(
        z.object({
          description: z.string(),
          documents: z.array(
            z.object({
              content: z.string(),
              embeddings: z.array(z.number()),
              index: z.int().check(z.minimum(0)),
              progress: z.number().check(z.minimum(0), z.maximum(1))
            })
          ),
          id: z.string()
        })
      ),
      chatId: z.string(),
      feedbackEnabled: z.boolean(),
      path: z.array(z.number()),
      scratchpad: z._default(z.boolean(), false)
    }),
    type: z.literal('startLLMGeneration')
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
            chunks,
            model: task.arguments.modelId,
            providerId: task.arguments.providerId,
            signal,
            tags
          })
            .inspectErr((e) => console.log(e))
            .unwrapOr({ tags: [], title: 'Untitled Chat' });

          await logger.dispatch({
            data: { id: chat.id, tags: generated.tags, title: generated.title },
            type: 'updateChat'
          });
        },
        id,
        priority,
        serialize: () => ({ id, priority, task }),
        type: task.type
      };
    case 'saveScratchpadChat':
      return {
        async handler() {
          const chat = Option.from(await fetchers.userMetadata.byId(USER_METADATA_KEYS.SCRATCHPAD_CHAT)).andThen(
            (chat) => safeParseJson(chat, { validate: chatsSchema.parse }).ok()
          );
          if (chat.isNone()) return;
          await logger.dispatch(
            {
              data: chat.unwrap(),
              type: 'createChat'
            },
            {
              data: { id: USER_METADATA_KEYS.SCRATCHPAD_CHAT },
              type: 'deleteUserMetadata'
            }
          );
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
              task.arguments.feedbackEnabled
            );
          signal.addEventListener('abort', () => controller.abort());
          await promise;

          if (task.arguments.scratchpad) {
            await logger.dispatch({
              data: {
                id: USER_METADATA_KEYS.SCRATCHPAD_CHAT,
                value: JSON.stringify(chat)
              },
              dontLog: true,
              type: 'setUserMetadata'
            });
            return;
          }
          await logger.dispatch({
            data: { finished: true, id: chat.id, messages: chat.messages.toJSON() },
            type: 'updateChat'
          });
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
