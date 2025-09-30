import { getLocalClock, setLocalClock } from '~/utils/clock';
import { db } from './client';
import * as schema from './schema';

async function receiveMessage(message: Omit<schema.TMessage, 'syncedAt'>) {
	const clock = await getLocalClock();
	// TODO: use transaction
	const [row] = await db
		.insert(schema.messages)
		.values({
			...message,
			syncedAt: clock.increment().toString()
		})
		.onConflictDoNothing({
			target: schema.messages.data
		})
		.returning();
	await setLocalClock(clock);
	return row ?? null;
}

export { receiveMessage };
