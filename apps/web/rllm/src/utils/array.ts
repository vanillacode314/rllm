/**
 * Moves an item in an array in place.
 * @param array The array to modify.
 * @param from The index of the item to move.
 * @param to The index to move the item to.
 */
export function moveInPlace<T>(array: T[], from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= array.length || to >= array.length) {
    return;
  }

  const [item] = array.splice(from, 1);
  array.splice(to, 0, item);
}
