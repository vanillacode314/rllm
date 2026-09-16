import config from '@rthings/config/oxlint.config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  ...config,
  overrides: [
    {
      // Fixtures are deliberately bare statements: `no-unused-expressions` is what
      // the rule under test is supposed to catch.
      files: ['tests/fixtures/**/*.ts'],
      rules: { 'no-unused-expressions': 'off' }
    }
  ]
});
