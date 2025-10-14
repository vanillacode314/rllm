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
