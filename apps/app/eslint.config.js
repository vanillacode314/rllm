import importAlias from '@dword-design/eslint-plugin-import-alias';
import { includeIgnoreFile } from '@eslint/compat';
import pluginJs from '@eslint/js';
import perfectionist from 'eslint-plugin-perfectionist';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

export default [
	includeIgnoreFile(gitignorePath),
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					ignoreRestSiblings: true
				}
			],
			'prefer-const': ['error', { destructuring: 'all' }]
		}
	},
	importAlias.configs.recommended,
	{
		rules: {
			'@dword-design/import-alias/prefer-alias': [
				'error',
				{
					alias: {
						'~': './src'
					}
				}
			]
		}
	},
	perfectionist.configs['recommended-natural'],
	{ files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] }
];
