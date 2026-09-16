import Fuse, { type IFuseOptions } from 'fuse.js';
import { createMemo, type Accessor } from 'solid-js';

export function useFuse<T>(
  options: {
    items: Accessor<T[]>;
    query: Accessor<string>;
    returnAllOnEmptyQuery?: boolean;
  } & IFuseOptions<T>
) {
  const { items, query, returnAllOnEmptyQuery = false, ...rest } = options;
  const fuse = createMemo(() => new Fuse(items(), rest));
  return createMemo(() => {
    if (query().length === 0) returnAllOnEmptyQuery ? items() : [];
    return fuse()
      .search(query())
      .map((match) => match.item);
  });
}
