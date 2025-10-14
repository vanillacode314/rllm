import { makeCreator } from 'mutative';

export const create = makeCreator({
	// enableAutoFreeze: import.meta.env.DEV,
	strict: import.meta.env.DEV
});
