import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from './Avatar'

const meta = { title: 'Primitives/Avatar', component: Avatar, args: { name: '阿明' } } satisfies Meta<typeof Avatar>
export default meta
type Story = StoryObj<typeof meta>

export const Medium: Story = {}
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }
export const Outlined: Story = { args: { outlined: true } }
export const Colours: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--bi-space-2)', flexWrap: 'wrap' }}>
      {Array.from({ length: 12 }, (_, i) => (
        <Avatar key={i} name={`M${i + 1}`} colorKey={`accent${i + 1}`} />
      ))}
    </div>
  ),
}
