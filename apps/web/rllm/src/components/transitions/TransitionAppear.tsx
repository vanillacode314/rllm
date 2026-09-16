import { createSwitchTransition } from '@solid-primitives/transition-group';
import { animate } from 'motion';
import { children, type ParentProps } from 'solid-js';

export function TransitionAppear(props: ParentProps) {
  const resolvedChildren = children(() => props.children);

  const transition = createSwitchTransition(() => resolvedChildren() as HTMLElement | undefined, {
    onEnter: async (el, done) => {
      try {
        await animate(
          el,
          { opacity: [0, 1], scale: [0, 1] },
          { bounce: 0.4, type: 'spring', visualDuration: 0.4 }
        );
        done();
      } catch {
        done();
      }
    },
    onExit: async (el, done) => {
      try {
        await animate(
          el,
          { opacity: [1, 0], scale: [1, 0] },
          { bounce: 0.4, type: 'spring', visualDuration: 0.4 }
        );
        done();
      } catch {
        done();
      }
    }
  });

  return <>{transition()}</>;
}
