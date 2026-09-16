import { createComputed, createMemo, on } from 'solid-js';
import { createStore, reconcile, type ReconcileOptions } from 'solid-js/store';

import { produce } from './immer';

export function createDerivedStore<const T extends object>(
  memo: (prev: NoInfer<T> | undefined) => T,
  options?: ReconcileOptions & { name?: string }
): T {
  const compute = createMemo(memo);
  const [s, set] = createStore(compute(), { name: options?.name });
  createComputed(on(compute, (next) => set(reconcile(next, options)), { defer: true }));
  return s;
}

export function createDerivedWritableStore<const T extends object>(
  memo: (prev: T | undefined) => T,
  options?: ReconcileOptions & { name?: string }
) {
  const compute = createMemo(memo);
  const [s, set] = createStore(compute(), { name: options?.name });
  createComputed(on(compute, (next) => set(reconcile(next, options)), { defer: true }));
  return [
    s,
    (fn: (value: T) => void) => {
      set((value) => produce(value, fn));
    }
  ] as const;
}
