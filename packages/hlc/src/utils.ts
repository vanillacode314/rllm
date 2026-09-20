import { HLC } from './hlc.ts';

export function tryParseHLCFromString(value: string): [HLC, null] | [null, unknown] {
  try {
    const hlc = HLC.fromString(value);
    return [hlc, null];
  } catch (error) {
    return [null, error];
  }
}
