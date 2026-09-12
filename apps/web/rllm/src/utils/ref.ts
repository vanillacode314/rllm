export function combineRefs<T extends HTMLElement>(
  ...refs: Array<((el: T) => void) | undefined>
): (el: T) => void {
  return (el: T) => {
    for (const ref of refs) {
      ref?.(el);
    }
  };
}
