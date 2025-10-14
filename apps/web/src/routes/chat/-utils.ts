import type { TMessage } from '~/types/chat';
import type { TTree } from '~/utils/tree';

function getLatestPath(messages: TTree<TMessage>, path: number[] = []): number[] {
	if (messages.children.length === 0) return path;
	path.push(messages.children.length - 1);
	return getLatestPath(messages.children[messages.children.length - 1], path);
}

export { getLatestPath };
