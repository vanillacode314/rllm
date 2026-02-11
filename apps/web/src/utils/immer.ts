import { Immer } from 'immer';

export const { produce } = new Immer({
  autoFreeze: false
});
