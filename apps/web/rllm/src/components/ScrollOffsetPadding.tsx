import { createResizeObserver } from '@solid-primitives/resize-observer';
import { createEffect, createSignal, on } from 'solid-js';

export function ScrollOffsetPadding(props: {
  margin: number;
  scrollRef?: HTMLElement;
  containerRef?: HTMLElement;
  targetSelector: string;
  class?: string;
}) {
  const [offsetHeight, setOffsetHeight] = createSignal(0);

  function updateOffset() {
    const scrollContainer = props.scrollRef;
    if (!scrollContainer) return;

    const targetEl = scrollContainer.querySelector<HTMLElement>(props.targetSelector);
    if (!targetEl) return;

    // Calculate distance from top of container to bottom of target element
    const targetBottomOffset = targetEl.offsetTop + targetEl.offsetHeight;

    // Total distance from top of target bottom to absolute bottom of content (excluding padding div itself)
    const contentBelowTarget = scrollContainer.scrollHeight - targetBottomOffset - offsetHeight();

    // Required extra height so target can align to top/bottom cleanly
    const requiredPadding = Math.max(
      0,
      scrollContainer.clientHeight - targetEl.offsetHeight - contentBelowTarget - props.margin
    );

    setOffsetHeight(requiredPadding);
  }

  createResizeObserver(() => props.containerRef, updateOffset);
  createEffect(on(() => props.targetSelector, updateOffset));

  return (
    <div
      class={props.class}
      style={{ height: `${offsetHeight()}px`, display: offsetHeight() > 0 ? undefined : 'none' }}
    />
  );
}

export default ScrollOffsetPadding;
