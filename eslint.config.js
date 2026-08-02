const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['**/node_modules/**', 'gsplay-frontend/**', 'tests/coverage/**']
  },
  {
    files: ['src/v2/**/*.js', 'scripts/**/*.js', 'tests/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }]
    }
  }
];
