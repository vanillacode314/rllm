import { ObjectPool } from 'object-pool';

export function makeNewStarryNightWorker() {
  return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
    name: 'starry-night',
    type: 'module'
  });
}

export const starryNightWorkerPool = new ObjectPool(
  makeNewStarryNightWorker,
  navigator.hardwareConcurrency
);
