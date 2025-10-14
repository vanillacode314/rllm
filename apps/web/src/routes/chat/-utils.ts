import type { TChat, TMessage } from '~/types/chat';

export function finalizeChat(chat: TChat, path: number[], error?: string) {
	chat.finished = true;
	const node = chat.messages.traverse(path).expect('should be able to traverse to node');
	if (node.value.isNoneOr((value) => value.type !== 'llm')) {
		console.error('currentNode is not an llm message');
		return;
	}

	const message = node.value.unwrap() as TMessage & { type: 'llm' };
	message.finished = true;
	const chunk = message.chunks.at(-1);
	if (chunk && 'finished' in chunk) chunk.finished = true;
	if (error) {
		message.error = error;
	}
}
