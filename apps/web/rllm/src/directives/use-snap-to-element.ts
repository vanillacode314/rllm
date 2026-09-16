import { type Accessor, createEffect, createSignal, on } from 'solid-js';

import { withTimeout } from '~/utils/promises';

type TSnapOptions = { behavior?: ScrollBehavior; margin?: number };
export function useSnapToElement(
  selector: Accessor<null | string | undefined>,
  options?: TSnapOptions
) {
  const [ref, setRef] = createSignal<HTMLElement | null>(null);

  async function snap(
    container: HTMLElement | null | undefined,
    selector: null | string | undefined,
    options: TSnapOptions | undefined
  ) {
    if (!container || !selector) return;

    const target = container.querySelector<HTMLElement>(selector);
    if (!target) return;

    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const targetTop =
        targetRect.top - containerRect.top + container.scrollTop - (options?.margin ?? 0);

      const result: any = container.scrollTo({
        behavior: options?.behavior ?? 'instant',
        top: targetTop
      });
      if (result instanceof Promise) {
        result.then(() => resolve()).catch(() => resolve());
      } else {
        resolve();
      }
    });
    return withTimeout(() => promise, 5000).catch(() => {});
  }

  createEffect(on([ref, selector], ([ref, selector]) => snap(ref, selector, options)));

  return {
    bind: setRef,
    snap: (selectorOverride?: string, optionsOverride?: TSnapOptions) =>
      snap(ref(), selectorOverride ?? selector(), optionsOverride ?? options)
  };
}
