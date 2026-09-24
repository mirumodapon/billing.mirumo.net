import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-types/**', '**/dev-dist/**', '**/storybook-static/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  // 相依方向：core 不得依賴任何 workspace 套件
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@billing/*'], message: '@billing/core 必須零相依，不得 import 任何 workspace 套件' },
            { group: ['react', 'react-dom', 'react/*'], message: '@billing/core 是純函式庫，不得 import React' },
          ],
        },
      ],
    },
  },
  // 相依方向：ui 不得依賴 core
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@billing/core', '@billing/core/*'], message: '@billing/ui 只認 props，不得依賴 @billing/core' },
          ],
        },
      ],
    },
  },
)
