import config from '@rthings/config/solid/oxlint.config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  ...config,
  jsPlugins: [...(config.jsPlugins ?? []), 'oxlint-plugin-ts-result-option'],
  rules: {
    ...config.rules,
    'no-await-in-loop': 'off',
    'ts-result-option/must-use-result': 'error'
  }
});
