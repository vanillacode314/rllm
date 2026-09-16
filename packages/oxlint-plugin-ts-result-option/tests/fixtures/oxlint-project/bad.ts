import { Option, Result } from 'ts-result-option';

declare const flag: boolean;

Result.Ok(1);
Option.Some(2).map((v) => v + 1);
flag && Result.Ok(3);
