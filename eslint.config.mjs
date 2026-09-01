import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'

export default [
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'build-dist/**',
      '.openflow-build/**',
      'extensions/chrome/**',
      '.cursor/**',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'no-control-regex': 'off',
      'no-useless-escape': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setImmediate: 'readonly',
        structuredClone: 'readonly',
        TextEncoder: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
]
