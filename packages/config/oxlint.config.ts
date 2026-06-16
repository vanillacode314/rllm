import * as perfectionist from 'eslint-plugin-perfectionist';
import { defineConfig } from 'oxlint';

export default defineConfig({
  categories: {
    correctness: 'error',
    perf: 'warn',
    suspicious: 'warn'
  },
  jsPlugins: ['eslint-plugin-perfectionist'],
  options: {
    typeAware: true
  },
  plugins: ['import', 'promise'],
  rules: {
    ...perfectionist.configs['recommended-natural'].rules,
    'no-shadow': 'allow',
    'no-underscore-dangle': 'allow'
  }
});
