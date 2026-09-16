import Fuse, { type IFuseOptions } from 'fuse.js';
import { type Accessor, createMemo } from 'solid-js';

export function useFuse<T>(
  options: IFuseOptions<T> & {
    items: Accessor<T[]>;
    query: Accessor<string>;
    returnAllOnEmptyQuery?: boolean;
  }
) {
  const { items, query, returnAllOnEmptyQuery = false, ...rest } = options;
  const fuse = createMemo(() => new Fuse(items(), rest));
  return createMemo(() => {
    if (query().length === 0) return returnAllOnEmptyQuery ? items() : [];
    return fuse()
      .search(query())
      .map((match) => match.item);
  });
}
