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

/**
 * Returns a new array with unique items based on a key.
 * @param array The array to filter.
 * @param key The key to use for uniqueness.
 */
export function uniqueBy<T extends object, K extends keyof T>(array: T[], key: K): T[] {
  const seen = new Set<T[K]>();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}
