import { createEventListenerMap } from '@solid-primitives/event-listener';
import { Gesture } from '@use-gesture/vanilla';
import { createEffect, on, onCleanup, splitProps, type JSX, type ParentProps } from 'solid-js';

import { createMotionValue } from '~/utils/motionone';
import { cn } from '~/utils/tailwind';

export type LoadMoreContainerProps = JSX.HTMLAttributes<HTMLDivElement> &
  ParentProps<{
    ref?: (el: HTMLDivElement) => void;
    hasMore: boolean;
    onLoadMore: () => void | Promise<void>;
    threshold?: number;
    innerClass?: string;
    innerRef?: JSX.HTMLAttributes<HTMLDivElement>['ref'];
  }>;

export function LoadMoreContainer(props: LoadMoreContainerProps) {
  const [local, others] = splitProps(props, [
    'innerRef',
    'ref',
    'class',
    'children',
    'innerClass',
    'hasMore',
    'onLoadMore',
    'threshold'
  ]);

  let ref!: HTMLDivElement;
  const [offset, { animate: animateOffset, set: setOffset }] = createMotionValue(0);
  const threshold = () => local.threshold ?? 80;
  let gestureInstance: Gesture | undefined;

  function resetOffset() {
    return animateOffset(0, { type: 'spring', stiffness: 200, damping: 15 });
  }

  createEffect(
    on(
      () => local.hasMore,
      (hasMore) => {
        gestureInstance?.destroy();
        if (!hasMore) return;

        gestureInstance = new Gesture(
          ref,
          {
            onWheel({ delta: [, dy], movement: [, my], wheeling }) {
              if (!wheeling) {
                const shouldLoadMore = offset() > threshold();
                resetOffset();
                shouldLoadMore && local.onLoadMore();
                return;
              }
              if (Math.floor(ref.scrollTop) > 0 || (dy >= 0 && my >= 0)) return;
              setOffset(offset() - dy * 0.03);
            }
          },
          {
            drag: { axis: 'y' },
            wheel: { axis: 'y' }
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
            shouldLoadMore && local.onLoadMore();
          }
        });
      }
    )
  );

  onCleanup(() => gestureInstance?.destroy());

  return (
    <div
      ref={(el) => {
        ref = el;
        local.ref?.(el);
      }}
      class={cn('overflow-auto touch-none', local.class)}
      {...others}
    >
      <div
        class={local.innerClass}
        style={{ transform: `translateY(${offset()}px)` }}
        ref={local.innerRef}
      >
        {local.children}
      </div>
    </div>
  );
}

export default LoadMoreContainer;
