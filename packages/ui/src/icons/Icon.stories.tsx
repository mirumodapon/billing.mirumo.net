import { IconCalculator, IconChartDonut, IconPlus, IconTrash, IconUsers } from '@tabler/icons-react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon } from './Icon'

const meta = { title: 'Icons/Icon', component: Icon, args: { glyph: IconPlus } } satisfies Meta<
  typeof Icon
>
export default meta
type Story = StoryObj<typeof meta>

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--bi-space-4)', alignItems: 'center' }}>
      <Icon glyph={IconPlus} size="sm" />
      <Icon glyph={IconPlus} size="md" />
      <Icon glyph={IconPlus} size="lg" />
    </div>
  ),
}

export const Inherits: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--bi-space-4)' }}>
      <span style={{ color: 'var(--bi-accent)' }}>
        <Icon glyph={IconUsers} />
      </span>
      <span style={{ color: 'var(--bi-danger)' }}>
        <Icon glyph={IconTrash} />
      </span>
      <span style={{ color: 'var(--bi-text-muted)' }}>
        <Icon glyph={IconChartDonut} />
      </span>
      <span style={{ color: 'var(--bi-warning)' }}>
        <Icon glyph={IconCalculator} />
      </span>
    </div>
  ),
}
