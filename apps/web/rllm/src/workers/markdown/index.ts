import { ObjectPool } from 'object-pool';

export function makeNewMarkdownWorker() {
  return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
    name: 'markdown',
    type: 'module'
  });
}

export const markdownWorkerPool = new ObjectPool(
  makeNewMarkdownWorker,
  navigator.hardwareConcurrency
);
