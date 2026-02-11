import { defineConfig } from 'eslint/config';
import importAlias from '@dword-design/eslint-plugin-import-alias';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import perfectionist from 'eslint-plugin-perfectionist';
import solid from 'eslint-plugin-solid/configs/typescript';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tseslint from 'typescript-eslint';
import eslintPluginTsResultOption from 'eslint-plugin-ts-result-option';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, '.gitignore');

export default defineConfig([
	{ ignores: ['src/routeTree.gen.ts'] },
	includeIgnoreFile(gitignorePath),
	{ languageOptions: { globals: { ...globals.browser, ...globals.node } } },
	js.configs.recommended,
	{
		...solid,
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				project: 'tsconfig.json'
			}
		},
		rules: {
			'solid/reactivity': 'off'
		}
	},
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_|_',
					destructuredArrayIgnorePattern: '^_'
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
	{ rules: { 'perfectionist/sort-objects': ['off'] } },
	{
		files: ['**/*.{ts,tsx}'],
		...eslintPluginTsResultOption.configs.recommended,
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2021,
				sourceType: 'module',
				project: ['./tsconfig.json'],
				tsconfigRootDir: __dirname
			}
		}
	},
	{ files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'] }
]);
