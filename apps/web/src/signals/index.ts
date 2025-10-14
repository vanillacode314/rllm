import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createMediaQuery } from '@solid-primitives/media';
import { createSignal } from 'solid-js';

const isMobile = createMediaQuery('(max-width: 767px)');
const [isTouchDown, setIsTouchDown] = createSignal(false);
createEventListenerMap(() => window, {
	touchstart: () => setIsTouchDown(true),
	touchend: () => setIsTouchDown(false),
	touchcancel: () => setIsTouchDown(false)
});

export { isMobile, isTouchDown };
