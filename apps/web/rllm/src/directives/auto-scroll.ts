import { createEventListenerMap } from '@solid-primitives/event-listener';
import { createTimeoutLoop } from '@solid-primitives/timer';
import { debounce } from '@tanstack/solid-pacer';
import { type Accessor, createMemo, createSignal, onMount } from 'solid-js';

export function useAutoScroll(
  options: {
    enabled?: Accessor<boolean>;
    threshold?: number;
  } = {}
) {
  let ref: HTMLElement;

  const { enabled = () => true, threshold = 50 } = options;
  const [scrollBottom, setScrollBottom] = createSignal(0);
  const [isDown, setIsDown] = createSignal(false);
  const shouldAutoScroll = createMemo(() => !isDown() && scrollBottom() < threshold);
  const canScroll = createMemo(() => scrollBottom() > threshold);

  function updateScrollBottom() {
    setScrollBottom(ref.scrollHeight - (ref.clientHeight + ref.scrollTop));
  }
  function updateHeight() {
    updateScrollBottom();
    scrollToBottom();
  }

  const scrollToBottom = debounce(
    (force: boolean = false) => {
      if (!ref) throw new Error('attach ref to autoScroll');

      if (!force) {
        if (!enabled()) return;
        if (!shouldAutoScroll()) return;
      }
      ref.scrollTo({ behavior: 'smooth', top: ref.scrollHeight });
    },
    {
      wait: 16
    }
  );

  const autoScroll = (_ref: HTMLElement) => {
    ref = _ref;
    createTimeoutLoop(updateHeight, 100);
    createEventListenerMap(
      _ref,
      {
        mousedown: () => setIsDown(true),
        mouseup: () => setIsDown(false),
        scroll: () => updateScrollBottom(),
        touchcancel: () => setIsDown(false),
        touchend: () => setIsDown(false),
        touchstart: () => setIsDown(true)
      },
      { passive: true }
    );
  };

  return [{ autoScroll, canScroll, shouldAutoScroll }, { scrollToBottom }] as const;
}
