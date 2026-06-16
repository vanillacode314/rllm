import { ObjectPool } from 'object-pool';

export function makeNewRagWorker() {
  return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
    name: 'rag',
    type: 'module'
  });
}

export const ragWorkerPool = new ObjectPool(makeNewRagWorker, navigator.hardwareConcurrency);

export async function cosineSimilarity(a: number[], b: number[]) {
  const worker = await ragWorkerPool.get();
  let result;
  try {
    result = worker.cosineSimilarity(a, b);
  } finally {
    ragWorkerPool.release(worker);
  }
  return result;
}

export async function getEmbedding(text: string) {
  const worker = await ragWorkerPool.get();
  let result;
  try {
    result = worker.getEmbedding(text);
  } finally {
    ragWorkerPool.release(worker);
  }
  return result;
}
