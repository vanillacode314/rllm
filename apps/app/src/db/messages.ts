import { getLocalClock, setLocalClock } from '~/utils/clock';
import { db, TTransaction } from './client';
import * as schema from './schema';

async function receiveMessage(
	message: Omit<schema.TMessage, 'syncedAt'>,
	tx?: TTransaction
): Promise<null | schema.TMessage> {
	if (!tx) return db.transaction((tx) => receiveMessage(message, tx));
	const clock = await getLocalClock(tx);
	const [row] = await tx
		.insert(schema.messages)
		.values({
			...message,
			syncedAt: clock.increment().toString()
		})
		.onConflictDoNothing({
			target: schema.messages.data
		})
		.returning();
	await setLocalClock(clock, tx);
	return row ?? null;
}

export { receiveMessage };
