module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/prefer-readonly': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-var-requires': 'warn',
    'no-console': 'off',
    'prefer-const': 'error',
    'no-var': 'error'
  },
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.config.js',
    '*.config.ts'
  ]
};
