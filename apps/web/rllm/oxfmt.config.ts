import config from '@rthings/config/oxfmt.config';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...config,
  ignorePatterns: ['src/routeTree.gen.ts', 'src/db/migrations.json']
});
