import type { Accessor } from 'solid-js';

import { createEventListenerMap } from '@solid-primitives/event-listener';

export function hoverStateChange(ref: HTMLElement, options: Accessor<(value: boolean) => void>) {
  const onChange = options();
  createEventListenerMap(ref, {
    focusin: () => onChange(true),
    focusout: () => onChange(false),
    mouseenter: () => onChange(true),
    mouseleave: () => onChange(false)
  });
}
