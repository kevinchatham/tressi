import pluginSimpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import tsLint from 'typescript-eslint';

export default [
  {
    ignores: [
      'temp/',
      'node_modules/',
      '**/node_modules/',
      '**/dist/',
      '**/.angular/',
    ],
  },
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  ...tsLint.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      'simple-import-sort': pluginSimpleImportSort,
    },
    rules: {
      'no-console': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      eqeqeq: ['error', 'smart'],
      'simple-import-sort/imports': ['warn'],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'memberLike',
          modifiers: ['private'],
          format: ['camelCase'],
          leadingUnderscore: 'require',
        },
      ],
    },
  },
];
