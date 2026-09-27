import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CATEGORY_ICONS, type CategoryIconName } from '../icons/categoryIcons'
import { IconGrid } from './IconGrid'

const meta = {
  title: 'Input/IconGrid',
  component: IconGrid,
  args: { icons: {}, value: '', onChange: () => undefined, ariaLabel: '圖示', labelFor: (n: string) => n },
} satisfies Meta<typeof IconGrid>
export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [value, setValue] = useState<CategoryIconName>('IconToolsKitchen2')
  return (
    <IconGrid
      icons={CATEGORY_ICONS}
      value={value}
      onChange={setValue}
      ariaLabel="類別圖示"
      labelFor={(name) => name.replace(/^Icon/, '')}
    />
  )
}

export const CategoryWhitelist: Story = { render: () => <Demo /> }
