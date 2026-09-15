import { createEffect, createSignal, on, type Accessor } from 'solid-js';

type TSnapOptions = { behavior?: ScrollBehavior; margin?: number };
export function useSnapToElement(
  selector: Accessor<string | null | undefined>,
  options?: TSnapOptions
) {
  const [ref, setRef] = createSignal<HTMLElement | null>(null);

  function snap(
    container: HTMLElement | undefined | null,
    selector: string | null | undefined,
    options: undefined | TSnapOptions
  ) {
    if (!container || !selector) return;

    const target = container.querySelector<HTMLElement>(selector);
    if (!target) return;

    requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();

      const targetTop =
        targetRect.top - containerRect.top + container.scrollTop - (options?.margin ?? 0);

      container.scrollTo({
        top: targetTop,
        behavior: options?.behavior ?? 'instant'
      });
    });
  }

  createEffect(on([ref, selector], ([ref, selector]) => snap(ref, selector, options)));

  return {
    bind: setRef,
    snap: (selectorOverride?: string, optionsOverride?: TSnapOptions) =>
      snap(ref(), selectorOverride ?? selector(), optionsOverride ?? options)
  };
}
