import { Option, Result } from 'ts-result-option';

Result.Ok(1);
Option.Some(1);
Result.Ok(1).map((v) => v + 1);
Result.Ok(1).unwrap();
Option.Some(1).inspect((v) => console.log(v));
Result.Ok(1).inspectErr((e) => console.log(e));
void Result.Err(new Error('x'));
declare const u: Result<number, Error> | undefined;
u;
