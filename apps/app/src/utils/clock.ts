import { HLC } from 'hlc';

import { db, TTransaction } from '~/db/client';

import { getMetadata, setMetadata } from './db';

async function getLocalClock(tx?: TTransaction): Promise<HLC> {
	if (!tx) return db.transaction((tx) => getLocalClock(tx));
	const clockString = await getMetadata('clock', tx);
	const clock = clockString !== undefined ? HLC.fromString(clockString) : HLC.generate();
	if (clockString === undefined) await setLocalClock(clock, tx);
	return clock;
}

function setLocalClock(HLC: HLC, tx?: TTransaction): Promise<void> {
	return setMetadata('clock', HLC.toString(), tx);
}

export { getLocalClock, setLocalClock };
