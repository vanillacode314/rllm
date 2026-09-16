import { createStore, produce } from 'solid-js/store';

export type TIndexingProgress = { current: number; name: string };

export const [indexingProgress, setIndexingProgress] = createStore<
  Record<string, TIndexingProgress>
>({});

export function removeIndexingProgress(id: string) {
  setIndexingProgress(
    produce((draft) => {
      delete draft[id];
    })
  );
}

export function updateIndexingProgress(id: string, name: string, current: number) {
  setIndexingProgress(id, { current, name });
}
