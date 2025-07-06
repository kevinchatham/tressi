import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tsLint from 'typescript-eslint';

export default [
  {
    // https://eslint.org/docs/latest/use/configure/ignore
    // only ignore node_modules in the same directory as the configuration file
    // so you have toS add `**/` pattern to include nested directories (for example if you use pnpm workspace)
    ignores: ['node_modules/', '**/node_modules/', '**/dist/'],
  },
  {
    files: ['**/*.ts'],
  },
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  // rules
  ...tsLint.configs.recommended,
  {
    plugins: {
      'simple-import-sort': pluginSimpleImportSort,
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      eqeqeq: ['error', 'smart'],
      'simple-import-sort/imports': ['warn'],
    },
  },
];
