import { createEffect, on, type Accessor } from 'solid-js';

export function useSnapToElement(
  getContainer: Accessor<HTMLElement | null | undefined>,
  getSelector: Accessor<string | null | undefined>,
  options?: { behavior?: ScrollBehavior; margin?: number }
) {
  function snap(container?: HTMLElement | null, selector?: string | null) {
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

  createEffect(
    on([getContainer, getSelector], ([container, selector]) => snap(container, selector))
  );

  return () => snap(getContainer(), getSelector());
}
