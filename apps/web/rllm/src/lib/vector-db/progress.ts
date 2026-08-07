import { createStore } from 'solid-js/store';

export type TIndexingProgress = { current: number; name: string };

export const [indexingProgress, setIndexingProgress] = createStore<
  Record<string, TIndexingProgress>
>({});

export function removeIndexingProgress(id: string) {
  setIndexingProgress(id, undefined);
}

export function updateIndexingProgress(id: string, name: string, current: number) {
  setIndexingProgress(id, { current, name });
}
