import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createMediaQuery } from '@solid-primitives/media';
import { createSignal } from 'solid-js';

const isMobile = createMediaQuery('(max-width: 767px)');
const [isTouchDown, setIsTouchDown] = createSignal(false);
createEventListenerMap(() => window, {
  touchcancel: () => setIsTouchDown(false),
  touchend: () => setIsTouchDown(false),
  touchstart: () => setIsTouchDown(true)
});

export { isMobile, isTouchDown };
