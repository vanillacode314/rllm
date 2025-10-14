import { Result } from '~/result';

class ParseError extends Error {
	constructor(
		public text: string,
		public override cause: unknown
	) {
		super(`Failed to parse JSON(${text})`);
		this.name = 'ParseError';
		Object.setPrototypeOf(this, ParseError.prototype);
	}
}

class ValidationError extends Error {
	constructor(
		public input: unknown,
		public override cause: unknown
	) {
		super(`Failed to validate JSON(${JSON.stringify(input)}`);
		this.name = 'ValidationError';
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
}

const parse = Result.wrap(JSON.parse, (e, text) => new ParseError(text, e));
function safeParseJson<T = unknown>(
	value: string,
	config: {
		reviver?: (this: unknown, key: string, value: unknown) => unknown;
		validate?: (value: unknown) => T;
	} = {}
): typeof config.validate extends undefined ? Result<unknown, ParseError>
:	Result<T, ParseError | ValidationError> {
	const { reviver } = config;
	const json = parse(value, reviver);
	if (json.isErr() || config.validate === undefined) return json;
	const validate = Result.wrap(config.validate, (e, value) => new ValidationError(value, e));
	return validate!(json.unwrap());
}

export { ParseError, safeParseJson, ValidationError };
