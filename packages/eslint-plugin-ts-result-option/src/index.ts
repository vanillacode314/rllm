import fs from 'node:fs'
import path from 'node:path'

const pkg = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '../package.json'), 'utf8'),
) as typeof import('../package.json')

import { rule as mustUseResult } from './rules/must-use-result'

const namespace = pkg.name.replace(/^eslint-plugin-/, '')
const plugin = {
  meta: {
    name: pkg.name,
    version: pkg.version,
    namespace,
  },
  configs: {
    get recommended() {
      return recommended
    },
  },
  rules: { 'must-use-result': mustUseResult },
}

const recommended = {
  plugins: {
    [namespace]: plugin,
  },
  rules: {
    'ts-result-option/must-use-result': 'error',
  },
}

export default plugin
