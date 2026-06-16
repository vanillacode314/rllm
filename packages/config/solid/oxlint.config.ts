import solid from 'eslint-plugin-solid';
import { defineConfig } from 'oxlint';

import config from '../oxlint.config.ts';

export default defineConfig({
  ...config,
  jsPlugins: [...(config.jsPlugins ?? []), 'eslint-plugin-solid'],
  rules: {
    ...solid.configs['flat/typescript'].rules,
    ...config.rules
    // 'solid/reactivity': 'off'
  }
});
