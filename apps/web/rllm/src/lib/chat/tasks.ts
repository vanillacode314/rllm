import { logger } from '~/db/client';

import { createTask, type TTask } from '../background-task-manager/tasks';
import type { TChat } from '~/db/app-schema';
import { parseDbRowsInPlace } from '~/utils/db';

export async function retryFailedTitleAndTags() {
  const controller = new AbortController();
  const chats = parseDbRowsInPlace(
    await logger.db.query<Pick<TChat, 'id' | 'settings'>>(
      logger.sql`SELECT "id", "settings" FROM "chats" WHERE "title" = 'Untitled Chat' OR "title" = 'Untitled New Chat'`
    ),
    { jsonKeys: ['settings'] }
  );
  console.debug(`Found ${chats.length} chats with default titles`);
  const tasks = [] as TTask[];
  for (const chat of chats)
    tasks.push(
      createTask({
        arguments: {
          chatId: chat.id,
          modelId: chat.settings.modelId,
          path: [0],
          providerId: chat.settings.providerId
        },
        type: 'generateTitleAndTags'
      })
    );
  for (let i = 0; i < tasks.length; i += 10) {
    const promises = [] as Promise<void>[];
    for (const task of tasks.slice(i, i + 10)) {
      promises.push(Promise.try(() => void task.handler(controller.signal)));
    }
    // oxlint-disable-next-line no-await-in-loop
    await Promise.all(promises);
  }
}
