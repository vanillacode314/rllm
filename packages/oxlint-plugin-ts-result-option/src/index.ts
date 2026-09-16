import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { mustUseResult } from './rules/must-use-result.ts';

const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../package.json'), 'utf8')) as {
  name: string;
  version: string;
};

export default {
  meta: { name: pkg.name, version: pkg.version },
  rules: { 'must-use-result': mustUseResult }
};
