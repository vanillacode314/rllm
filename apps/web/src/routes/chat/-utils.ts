import type { TChat, TMessage } from '~/types/chat';

export function finalizeChat(chat: TChat, path: number[], error?: string) {
	const node = chat.messages.traverse(path).expect('should be able to traverse to node');
	if (node.value.isNoneOr((value) => value.type !== 'llm')) {
		console.error('currentNode is not an llm message');
		return;
	}

	const message = node.value.unwrap() as TMessage & { type: 'llm' };
	if (error) {
		message.error = error;
	}
}
