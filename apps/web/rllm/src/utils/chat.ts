import type { ParsedLocation } from '@tanstack/solid-router';

import { Result } from 'ts-result-option';

import type { TMessage } from '~/types/chat';

import type { TTree } from './tree';

const getMessagesForPath = (path: number[], tree: TTree<TMessage>) =>
  Result.from(
    () =>
      tree
        .iter(path)
        .map(({ node }) => node.unwrap().value.unwrap())
        .toArray(),
    (e) => new Error(`Error getting messages for path ${path}`, { cause: e })
  );

export { getMessagesForPath };

export function isChatOpen(location: ParsedLocation, chatId: string): boolean {
  return (
    location.pathname.startsWith('/chat/') &&
    'id' in location.search &&
    location.search.id === chatId
  );
}
