import type { Transaction } from 'sqlocal';

import { HLC } from 'hlc';
import { AsyncResult, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { getMetadata, setMetadata } from './db';

const getLocalClock = (tx?: Transaction): AsyncResult<HLC, Error> =>
	tryBlock(
		async function* () {
			const clock = yield* getMetadata('clock', tx);
			if (clock.isNone()) return Result.Err(new Error('No clock found'));
			return Result.Ok(HLC.fromString(clock.unwrap()));
		},
		(e) => new Error('Failed to get local clock', { cause: e })
	);

function setLocalClock(HLC: HLC, tx?: Transaction) {
	return setMetadata('clock', HLC.toString(), tx);
}

export { getLocalClock, setLocalClock };
