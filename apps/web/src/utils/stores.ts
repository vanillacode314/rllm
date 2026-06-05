import { createComputed, on } from 'solid-js';
import { createStore, reconcile, type ReconcileOptions } from 'solid-js/store';

export function createDerivedStore<const TDeps, T extends object>(
  deps: () => TDeps,
  memo: (deps: TDeps, prev: T | undefined) => T,
  options?: ReconcileOptions
): T {
  let prev: T | undefined = undefined;
  const value = (deps: TDeps) => {
    return (prev = memo(deps, prev));
  };
  const [s, set] = createStore(value(deps()));
  createComputed(on(deps, (deps) => set(reconcile(value(deps), options)), { defer: true }));
  return s;
}
