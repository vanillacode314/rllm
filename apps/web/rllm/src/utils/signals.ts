// oxlint-disable solid/reactivity
import { createConnectivitySignal } from '@solid-primitives/connectivity';
import { createPageVisibility } from '@solid-primitives/page-visibility';
import { createScheduled, debounce } from '@solid-primitives/scheduled';
import {
  type Accessor,
  createComputed,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  type InitializedResource,
  on,
  onCleanup,
  onMount,
  type Resource,
  type Setter,
  type Signal,
  untrack
} from 'solid-js';
import { createStore } from 'solid-js/store';

import { produce } from './immer';

const isOnline = createConnectivitySignal();
const pageVisible = createPageVisibility();

export function createWritableMemo<T>(
  fn: (prev: NoInfer<T> | undefined) => T,
  value?: NoInfer<T>,
  options?: { equals: (a: T, b: T) => boolean; name?: string }
): [Accessor<T>, Setter<T>] {
  const m = createMemo((prev) => createSignal(fn(prev?.[0]())), value, options);
  return [() => m()[0](), (...args) => m()[1](...(args as never))];
}

function createDebouncedMemo<T>(
  fn: (p: T | undefined) => T,
  value: NoInfer<T>,
  options?: NoInfer<{
    duration?: number;
    equals?: ((prev: T, next: T) => boolean) | false;
    name?: string;
  }>
) {
  const scheduled = createScheduled((fn) => debounce(fn, options?.duration ?? 1000));
  return createMemo((value) => (scheduled() ? fn(value) : value), value, options);
}

function syncToURLHash(signal: Signal<boolean>, key: string): Signal<boolean> {
  key = '#' + key;
  const s = createMemo(signal[0]);
  const set = signal[1];

  function updateSignalOnURLHashChange() {
    set(window.location.hash === key);
  }
  onMount(() => {
    if (window.location.hash === key) {
      window.history.replaceState({}, document.title, window.location.href.replace(/#.*$/g, ''));
    }
    window.addEventListener('hashchange', updateSignalOnURLHashChange);
    onCleanup(() => window.removeEventListener('hashchange', updateSignalOnURLHashChange));
  });

  function updateURLHashOnSignalChange() {
    const v = s();
    untrack(() => {
      if (v) {
        window.location.hash = key;
      } else if (window.location.hash === key) {
        window.history.replaceState({}, document.title, window.location.href.replace(/#.*$/g, ''));
      }
    });
  }
  createEffect(updateURLHashOnSignalChange);

  return [s, set];
}

export { createDebouncedMemo, isOnline, pageVisible, syncToURLHash };
