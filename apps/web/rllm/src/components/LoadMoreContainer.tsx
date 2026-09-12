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
  const [offset, animateOffset] = createMotionValue(0);
  const threshold = () => local.threshold ?? 80;
  let gestureInstance: Gesture | undefined;

  function resetOffset() {
    return animateOffset(0, { type: 'spring', stiffness: 200, damping: 15 });
  }

  createEffect(
    on(
      () => local.hasMore,
      (hasMore) => {
        if (!hasMore) {
          resetOffset();
          gestureInstance?.destroy();
          return;
        }
        gestureInstance = new Gesture(
          ref,
          {
            onWheel({ velocity: [, vy], delta: [, dy], movement: [, my], wheeling, memo }) {
              // HACK: inertia animations aren't cancelled properly, waiting for upstream fix
              if (memo) {
                memo.stop();
                memo.complete();
              }
              if (!wheeling) {
                const shouldLoadMore = offset() > threshold();
                resetOffset();
                shouldLoadMore && local.onLoadMore();
                return;
              }

              // Only pull when we're pinned at the very top.
              if (Math.floor(ref.scrollTop) !== 0) return;
              // Ignore downward wheel — let the browser handle it.
              if (dy >= 0 && my >= 0) return;

              return animateOffset(-my, {
                type: 'inertia',
                velocity: vy,
                power: 8
              });
            },
            onDrag({ velocity: [, vy], delta: [, dy], movement: [, my], down, memo }) {
              // HACK: inertia animations aren't cancelled properly, waiting for upstream fix
              if (memo) {
                memo.stop();
                memo.complete();
              }

              if (!down) {
                const shouldLoadMore = offset() > threshold();
                resetOffset().then(() => shouldLoadMore && local.onLoadMore());
                return;
              }

              // Only pull when we're pinned at the very top.
              if (Math.floor(ref.scrollTop) !== 0) return;
              // Ignore downward drag let the browser handle it.
              if (dy >= 0 && my >= 0) return;

              return animateOffset(-my, {
                type: 'inertia',
                velocity: vy,
                power: 8
              });
            }
          },
          { eventOptions: { passive: true } }
        );
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
      class={cn('overflow-auto overscroll-y-none', local.class)}
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
