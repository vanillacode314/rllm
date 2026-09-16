import { createEventListenerMap } from '@solid-primitives/event-listener';
import { WheelGesture } from '@use-gesture/vanilla';
import type { AnimationPlaybackControls } from 'motion';
import { createEffect, createSignal, on, onCleanup, type Accessor, type JSX } from 'solid-js';

import { createMotionValue } from '~/utils/motionone';

export type UsePullToLoadMoreOptions = {
  hasMore: Accessor<boolean>;
  onLoadMore: () => void | Promise<void>;
  threshold?: number;
};

export function usePullToLoadMore(options: UsePullToLoadMoreOptions) {
  const [ref, setRef] = createSignal<HTMLDivElement | null>(null);
  const [offset, { animate: animateOffset, set: setOffset }] = createMotionValue(0);
  const threshold = () => options.threshold ?? 50;
  let currentAnimation: AnimationPlaybackControls | null = null;
  const animationWaiters = new Set<() => void>();

  function resetOffset() {
    for (const resolve of animationWaiters) resolve();
    animationWaiters.clear();
    return (currentAnimation = animateOffset(0, { type: 'spring', stiffness: 200, damping: 15 }));
  }

  function waitForAnimation(): Promise<void> {
    const animation = currentAnimation;
    if (!animation) return Promise.resolve();
    const { promise, resolve } = Promise.withResolvers<void>();
    const settle = () => {
      animationWaiters.delete(resolve);
      resolve();
    };
    animationWaiters.add(resolve);
    animation.finished.then(settle, settle);
    return promise;
  }

  createEffect(
    on([ref, options.hasMore], ([ref, hasMore]) => {
      if (!ref || !hasMore) return;

      const gestureInstance = new WheelGesture(
        ref,
        ({ delta: [, dy], movement: [, my], wheeling }) => {
          if (!wheeling) {
            const shouldLoadMore = offset() > threshold();
            resetOffset();
            shouldLoadMore && options.onLoadMore();
            return;
          }
          if (Math.floor(ref.scrollTop) > 0 || (dy >= 0 && my >= 0)) return;
          setOffset(offset() - dy * 0.03);
        }
      );

      let down = false;
      let startY = 0;
      createEventListenerMap(ref, {
        touchstart: (event) => {
          down = true;
          startY = event.touches[0].clientY;
        },
        touchmove: (event) => {
          if (!down) return;
          if (Math.floor(ref.scrollTop) > 0) return;
          const dy = event.touches[0].clientY - startY;
          if (dy < 0) return;
          setOffset(dy * 0.3);
        },
        touchend: () => {
          down = false;
          const shouldLoadMore = offset() > threshold();
          resetOffset();
          shouldLoadMore && options.onLoadMore();
        }
      });

      onCleanup(() => {
        gestureInstance.destroy();
      });
    })
  );

  return {
    bind: setRef,
    offset,
    threshold,
    waitForAnimation,
    innerStyle: (): JSX.CSSProperties => ({ transform: `translateY(${offset()}px)` })
  };
}
