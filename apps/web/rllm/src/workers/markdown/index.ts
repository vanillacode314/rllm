import { ObjectPool } from 'object-pool';
import type { VFile } from 'vfile';

export function makeNewMarkdownWorker() {
  return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
    name: 'markdown',
    type: 'module'
  });
}

export const markdownWorkerPool = new ObjectPool(
  makeNewMarkdownWorker,
  Math.min(navigator.hardwareConcurrency, 4)
);

export async function parse(file: VFile) {
  const worker = await markdownWorkerPool.get();
  let result;
  try {
    result = await worker.parse(file);
  } finally {
    markdownWorkerPool.release(worker);
  }
  return result;
}
