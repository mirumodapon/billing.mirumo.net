import type { Meta, StoryObj } from '@storybook/react-vite'
import { Chip } from './Chip'

const meta = { title: 'Primitives/Chip', component: Chip, args: { label: '現金' } } satisfies Meta<typeof Chip>
export default meta
type Story = StoryObj<typeof meta>

export const Label: Story = {}
export const Selectable: Story = { args: { onSelect: () => {} } }
export const Selected: Story = { args: { onSelect: () => {}, selected: true } }
export const Disabled: Story = { args: { onSelect: () => {}, disabled: true } }
export const WithDot: Story = { args: { label: '阿明', colorKey: 'accent3' } }
