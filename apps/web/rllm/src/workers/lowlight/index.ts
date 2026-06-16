import { ObjectPool } from 'object-pool';

export function makeNewLowlightWorker() {
  return new ComlinkWorker<typeof import('./worker')>(new URL('./worker', import.meta.url), {
    name: 'starry-night',
    type: 'module'
  });
}

export const lowlightWorkerPool = new ObjectPool(
  makeNewLowlightWorker,
  navigator.hardwareConcurrency
);
