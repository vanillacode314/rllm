import { Option, Result } from 'ts-result-option';

const r = Result.Ok(1);
console.log(r.unwrapOr(0));
void Result.Err(new Error('x'));

let bound: Option<number> | undefined;
bound = Option.Some(3);
console.log(bound.unwrapOr(0));

declare function readOption(): Option<number>;
readOption();
readOption().inspect((value) => console.log(value));
