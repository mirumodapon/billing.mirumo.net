import type { Preview } from '@storybook/react-vite'
import { withThemeByDataAttribute } from '@storybook/addon-themes'
import { DEFAULT_THEME, THEMES } from '../src/theme/manifest'
import '../src/styles/tokens.css'

const preview: Preview = {
  parameters: {
    // 這是 mobile-only 的設計系統，桌機寬度的 story 沒有意義
    viewport: {
      defaultViewport: 'mobile2',
      disable: false,
    },
    backgrounds: { disable: true },
    a11y: { test: 'error' },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: Object.fromEntries(THEMES.map((t) => [t.label, t.id])),
      defaultTheme: THEMES.find((t) => t.id === DEFAULT_THEME)!.label,
      attributeName: 'data-theme',
    }),
  ],
}

export default preview
