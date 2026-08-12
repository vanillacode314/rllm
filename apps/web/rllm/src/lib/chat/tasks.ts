import { eq, or } from 'drizzle-orm';

import { db } from '~/db/client';
import { tables } from '~/db/schema';

import { createTask, type TTask } from '../background-task-manager/tasks';

export async function retryFailedTitleAndTags() {
  const controller = new AbortController();
  const chats = await db
    .select({ id: tables.chats.id, settings: tables.chats.settings })
    .from(tables.chats)
    .where(
      or(eq(tables.chats.title, 'Untitled Chat'), eq(tables.chats.title, 'Untitled New Chat'))
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
