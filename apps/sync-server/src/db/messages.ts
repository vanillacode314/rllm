import { db, type TTransaction } from './client';
import * as schema from './schema';

function receiveMessages(
  messages: schema.TMessage[],
  tx?: TTransaction
): Promise<schema.TMessage[]> {
  if (!tx) return db.transaction((tx2) => receiveMessages(messages, tx2));
  return tx
    .insert(schema.messages)
    .values(messages)
    .onConflictDoNothing({
      target: [schema.messages.accountId, schema.messages.timestamp]
    })
    .returning();
}

export { receiveMessages };
