import { IconDots } from '@tabler/icons-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { AppBar } from './AppBar'

const meta = { title: 'Layout/AppBar', component: AppBar } satisfies Meta<typeof AppBar>
export default meta
type Story = StoryObj<typeof meta>

export const TitleOnly: Story = { args: { title: '旅程' } }
export const WithBack: Story = { args: { title: '東京五日', onBack: () => undefined } }
export const WithBackAndAction: Story = {
  args: {
    title: '東京五日',
    onBack: () => undefined,
    action: { glyph: IconDots, ariaLabel: '更多', onPress: () => undefined },
  },
}
export const LongTitle: Story = {
  args: { title: '二〇二六年春季北海道函館小樽札幌九日', onBack: () => undefined },
}
