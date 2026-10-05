import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const base = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);

export default [
  ...base,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/dashboard/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        Blob: 'readonly',
        EventSource: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        clearTimeout: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        history: 'readonly',
        location: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
      },
    },
  },
];
