import { createStore, get, set } from 'idb-keyval';

import { deserializeTask, type TTask, type TTaskPriority } from './tasks';

export class BackgroundTaskManager {
  private static concurrency = 6;
  private static initialized = false;
  private static items = new Set<{
    promise: { promise: Promise<void>; reject: (reason: any) => void; resolve: () => void };
    signal: AbortSignal;
    status: 'idle' | 'pending';
    task: TTask;
  }>();
  private static running = 0;
  private static store = createStore('background-task-manager', 'background-task-manager-store');

  static async init() {
    this.initialized = true;
    const items = await get('tasks', this.store);
    if (!items) return;
    const controller = new AbortController();
    for (const item of items) {
      try {
        this.items.add({
          promise: Promise.withResolvers<void>(),
          signal: controller.signal,
          status: item.status,
          task: deserializeTask(item.task)
        });
      } catch (error) {
        console.error(error);
      }
    }
    await this.serialize();
    this.runTask();
  }

  static async scheduleTask(
    task: TTask,
    priority?: TTaskPriority
  ): Promise<{
    abort: () => Promise<void>;
    promise: Promise<void>;
  }> {
    if (!this.initialized) {
      throw new Error('BackgroundTaskManager not initialized');
    }
    const controller = new AbortController();
    const effectivePriority = priority ?? task.priority ?? 'idle';
    const item = {
      promise: Promise.withResolvers<void>(),
      signal: controller.signal,
      status: 'idle',
      task: { ...task, priority: effectivePriority }
    } as const;
    this.items.add(item);
    await this.serialize();
    this.runTask();
    const abort = async () => {
      controller.abort();
      this.items.delete(item);
      await this.serialize();
    };
    return {
      abort,
      promise: item.promise.promise
    };
  }

  private static getNextTask() {
    const allItems = this.items
      .values()
      .filter((item) => item.status === 'idle')
      .toArray()
      .sort((a, b) => {
        const priorityOrder: Record<TTaskPriority, number> = {
          hydrated: 4,
          idle: 3,
          immediate: 0,
          microtask: 1,
          timeout: 2
        };
        return priorityOrder[a.task.priority] - priorityOrder[b.task.priority];
      });
    return allItems[0];
  }

  private static getScheduler(priority: TTaskPriority): (fn: () => void) => void {
    switch (priority) {
      case 'immediate':
      case 'microtask':
        return (fn) => queueMicrotask(fn);
      case 'timeout':
        return (fn) => setTimeout(fn, 0);
      case 'hydrated':
      case 'idle':
      default:
        return (fn) => requestIdleCallback(fn as IdleRequestCallback);
    }
  }

  private static async runTask() {
    if (this.running >= this.concurrency) return;
    const item = this.getNextTask();
    if (!item) return;
    this.running += 1;
    item.status = 'pending';
    const serializedTask = item.task.serialize();
    console.debug(`[BTM][Started Task][${item.task.type}][${item.task.id}]`, serializedTask);
    const schedule = this.getScheduler(item.task.priority);
    schedule(() =>
      Promise.try(item.task.handler, item.signal)
        .then(() => {
          console.debug(
            `[BTM][Completed Task][${item.task.type}][${item.task.id}]`,
            serializedTask
          );
          return item.promise.resolve();
        })
        .catch((reason) => {
          console.debug(`[BTM][Failed Task][${item.task.type}][${item.task.id}]`, serializedTask);
          item.promise.reject(reason);
        })
        .finally(async () => {
          this.items.delete(item);
          await this.serialize();
          this.running -= 1;
          this.runTask();
        })
    );
  }

  private static async serialize() {
    const items = new Set(
      this.items.values().map((item) => ({
        status: item.status,
        task: item.task.serialize()
      }))
    );
    await set('tasks', items, this.store);
  }
}
