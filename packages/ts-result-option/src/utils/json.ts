import { Result } from '~/result';

class ParseError extends Error {
	constructor(
		public value: string,
		public override cause: unknown
	) {
		super('Failed to parse JSON');
		this.name = 'ParseError';
		Object.setPrototypeOf(this, ParseError.prototype);
	}
}

class ValidationError extends Error {
	constructor(public override cause: unknown) {
		super('Failed to validate JSON');
		this.name = 'ValidationError';
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

function safeParseJson<T = unknown>(
	value: string,
	config: {
		reviver?: (this: unknown, key: string, value: unknown) => unknown;
		validate?: (value: unknown) => T;
	} = {}
): Result<T, Error> {
	const { reviver, validate } = config;
	return Result.fromThrowable<unknown, Error>(
		() => JSON.parse(value, reviver) as unknown,
		(e) => new ParseError(value, e)
	).andThen((value) => {
		if (!validate) return Result.Ok(value as T);
		return Result.fromThrowable(
			() => validate!(value),
			(e) => new ValidationError(e)
		);
	});
}

export { ParseError, safeParseJson, ValidationError };
