import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from './Skeleton'

const meta = { title: 'Primitives/Skeleton', component: Skeleton } satisfies Meta<typeof Skeleton>
export default meta
type Story = StoryObj<typeof meta>

export const SingleLine: Story = {}
export const Paragraph: Story = { args: { lines: 3 } }
export const Circle: Story = { args: { variant: 'circle' } }
export const Rect: Story = { args: { variant: 'rect' } }
