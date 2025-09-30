import { HLC } from 'hlc';

import { getMetadata, setMetadata } from './db';

async function getLocalClock(): Promise<HLC> {
	const clockString = await getMetadata('clock');
	const clock = clockString !== undefined ? HLC.fromString(clockString) : HLC.generate();
	if (clockString === undefined) await setLocalClock(clock);
	return clock;
}

function setLocalClock(HLC: HLC): Promise<void> {
	return setMetadata('clock', HLC.toString());
}

export { getLocalClock, setLocalClock };
