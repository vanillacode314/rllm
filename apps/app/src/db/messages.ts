import { db, type TTransaction } from './client';
import * as schema from './schema';

async function receiveMessage(
	message: schema.TMessage,
	tx?: TTransaction
): Promise<null | schema.TMessage> {
	if (!tx) return db.transaction((tx) => receiveMessage(message, tx));
	const [row] = await tx
		.insert(schema.messages)
		.values(message)
		.onConflictDoNothing({
			target: [schema.messages.accountId, schema.messages.data]
		})
		.returning();
	return row ?? null;
}

export { receiveMessage };
