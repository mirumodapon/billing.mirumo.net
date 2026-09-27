import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { AvatarToggleGroup } from './AvatarToggleGroup'

const meta = {
  title: 'Input/AvatarToggleGroup',
  component: AvatarToggleGroup,
  args: { items: [], selected: [], onChange: () => undefined, label: '參與者' },
} satisfies Meta<typeof AvatarToggleGroup>
export default meta
type Story = StoryObj<typeof meta>

function Demo() {
  const [selected, setSelected] = useState(['a', 'b'])
  return (
    <AvatarToggleGroup
      label="參與者"
      selected={selected}
      onChange={setSelected}
      minSelected={1}
      items={[
        { value: 'a', name: '阿明', colorKey: 'accent1' },
        { value: 'b', name: '小美', colorKey: 'accent4' },
        { value: 'c', name: '大熊', colorKey: 'accent7' },
        { value: 'd', name: 'May', colorKey: 'accent10' },
      ]}
    />
  )
}

export const Participants: Story = { render: () => <Demo /> }
