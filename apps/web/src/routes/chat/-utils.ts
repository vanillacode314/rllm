import type { TChat, TMessage } from '~/types/chat';

import { formatError } from '~/utils/errors';

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
  for (const chunk of message.chunks) {
    if (chunk.type === 'tool_call' && chunk.success === null) {
      chunk.success = false;
      chunk.content = formatError(new Error('Failed to execute tool'));
    }
  }
}
