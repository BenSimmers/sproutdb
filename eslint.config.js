import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const base = tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
);

// `tseslint.config(...)` returns a flat-config array. Merge it with an
// additional flat-config block that declares the files to ignore using
// the `ignores` property (replaces the deprecated .eslintignore behavior).
export default [
  ...base,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
