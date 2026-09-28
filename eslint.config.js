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
  // 建置用的 Node 腳本（例如 apps/web/scripts/check-deps-built.mjs）
  {
    files: ['**/scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  // 相依方向：core 不得依賴任何 workspace 套件
  // 用白名單而不是黑名單（task#64）：只准相對路徑。黑名單擋不住 fast-check 之類的
  // devDependency 被原始碼 import 後打包進 dist。測試檔不受限（vitest、fast-check、node:fs）
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [{ regex: '^(?!\\.{1,2}/)', message: '@billing/core 必須零相依：原始碼只能 import 自己的檔案' }],
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
