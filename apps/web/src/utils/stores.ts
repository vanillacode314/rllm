import { createComputed, on } from 'solid-js';
import { createStore, reconcile, type ReconcileOptions } from 'solid-js/store';

export function createDerivedStore<T extends object>(memo: () => T, options?: ReconcileOptions): T {
  const [s, set] = createStore(memo());
  createComputed(on(memo, (value) => set(reconcile(value, options)), { defer: true }));
  return s;
}
