import type { Meta, StoryObj } from '@storybook/react-vite'
import { ACCENT_ORDER } from '../theme/accentOrder'
import { Avatar } from './Avatar'

const meta = { title: 'Primitives/Avatar', component: Avatar, args: { name: '阿明' } } satisfies Meta<typeof Avatar>
export default meta
type Story = StoryObj<typeof meta>

export const Medium: Story = {}
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }
export const Outlined: Story = { args: { outlined: true } }
// 依指派順序排：第 n 個就是第 n 位成員會拿到的顏色
export const Colours: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--bi-space-2)', flexWrap: 'wrap' }}>
      {ACCENT_ORDER.map((slot, i) => (
        <Avatar key={slot} name={`M${i + 1}`} colorKey={slot} />
      ))}
    </div>
  ),
}
