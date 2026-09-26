import type { Meta, StoryObj } from '@storybook/react-vite'
import { Scrim } from './Scrim'

const meta = { title: 'Overlay/Scrim', component: Scrim } satisfies Meta<typeof Scrim>
export default meta
type Story = StoryObj<typeof meta>

export const OverContent: Story = {
  render: () => (
    <div>
      <p style={{ color: 'var(--bi-text)' }}>切換主題看遮罩深淺——淺色主題的遮罩應該比深色主題淡</p>
      <Scrim />
    </div>
  ),
}
