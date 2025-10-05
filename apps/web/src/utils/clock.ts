import type { Transaction } from 'sqlocal';

import { HLC } from 'hlc';

import { getMetadata, setMetadata } from './db';

async function getLocalClock(): Promise<HLC> {
	const clock = await getMetadata('clock');
	if (!clock) throw new Error('No clock found');
	return HLC.fromString(clock);
}

function setLocalClock(HLC: HLC, tx?: Transaction): Promise<void> {
	return setMetadata('clock', HLC.toString(), tx);
}

export { getLocalClock, setLocalClock };
