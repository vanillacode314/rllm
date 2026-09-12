import {
  animate,
  motionValue,
  type MotionValueOptions,
  type ValueAnimationTransition
} from 'motion';
import { from } from 'solid-js';

export function createMotionValue(init: number, options?: MotionValueOptions) {
  const value = motionValue(init, options);
  const s = from((set) => {
    value.on('change', (latest) => set(() => latest));
    return () => value.destroy();
  }, init);
  return [
    s,
    (to: number, options: ValueAnimationTransition<number>) => animate(value, to, options)
  ] as const;
}
