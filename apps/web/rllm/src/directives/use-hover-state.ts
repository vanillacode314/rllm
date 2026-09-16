import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createSignal } from 'solid-js';

export function useHoverState() {
  const [hovering, setHovering] = createSignal(false);
  return {
    bind: (ref: HTMLElement) => {
      createEventListenerMap(
        ref,
        {
          focusin: () => setHovering(true),
          focusout: () => setHovering(false),
          mouseenter: () => setHovering(true),
          mouseleave: () => setHovering(false)
        },
        { passive: true }
      );
    },
    get: hovering
  };
}
