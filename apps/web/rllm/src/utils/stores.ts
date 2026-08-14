import { createComputed, createMemo, on } from 'solid-js';
import { createStore, reconcile, type ReconcileOptions, unwrap } from 'solid-js/store';

export function createDerivedStore<const T extends object>(
  memo: (prev: NoInfer<T> | undefined) => T,
  options?: ReconcileOptions & { name?: string }
): T {
  const compute = createMemo(memo);
  const [s, set] = createStore(compute(), { name: options?.name });
  createComputed(on(compute, (next) => set(reconcile(next, options)), { defer: true }));
  return s;
}
