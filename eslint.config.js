import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src-tauri/**',
      'public/**',
      'docs/**',
      'artwork/**',
      '.playwright-mcp/**',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: {
        // Let the Svelte parser hand <script lang="ts"> blocks to the TS parser.
        parser: ts.parser,
      },
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Correctness-focused ruleset. Formatting is owned by Prettier; these
    // downgrades keep the linter useful without demanding a codebase-wide
    // rewrite of pre-existing pragmatic patterns.
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': 'warn',
      'no-undef': 'off',
      // Opinionated Svelte best-practices: surfaced as warnings rather than
      // errors so they don't block on pre-existing patterns. Fixing them
      // (e.g. choosing correct {#each} keys) is deliberate follow-up work,
      // not a mechanical lint-pass rewrite.
      'svelte/require-each-key': 'warn',
      'svelte/no-unused-svelte-ignore': 'warn',
      'svelte/prefer-svelte-reactivity': 'warn',
    },
  },
);
