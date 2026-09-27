import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { IconBed, IconCar, IconCoffee, IconDots, IconPlane, IconTent, IconTrain } from '@tabler/icons-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { IconGrid } from './IconGrid'

const icons = { IconCoffee, IconCar, IconPlane, IconTrain, IconBed, IconTent, IconDots } as const
type Name = keyof typeof icons
const names: Record<Name, string> = {
  IconCoffee: '咖啡', IconCar: '汽車', IconPlane: '飛機', IconTrain: '火車',
  IconBed: '床', IconTent: '帳篷', IconDots: '其他',
}
const labelFor = (name: Name) => names[name]

describe('IconGrid', () => {
  it('is a radiogroup with one radio per icon', () => {
    render(<IconGrid icons={icons} value="IconCar" onChange={vi.fn()} label="圖示" labelFor={labelFor} />)
    expect(screen.getByRole('radiogroup', { name: '圖示' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(7)
  })

  // 圖示沒有文字，名稱只能由呼叫端給；元件名 IconCar 不是給人念的
  it('names each icon through labelFor', () => {
    render(<IconGrid icons={icons} value="IconCar" onChange={vi.fn()} label="圖示" labelFor={labelFor} />)
    expect(screen.getByRole('radio', { name: '汽車' })).toBeChecked()
  })

  it('reports the icon that was pressed', async () => {
    const onChange = vi.fn()
    render(<IconGrid icons={icons} value="IconCar" onChange={onChange} label="圖示" labelFor={labelFor} />)
    await userEvent.click(screen.getByRole('radio', { name: '帳篷' }))
    expect(onChange).toHaveBeenCalledWith('IconTent')
  })

  it('moves a whole row with the down arrow', async () => {
    function Controlled() {
      const [v, setV] = useState<Name>('IconCoffee')
      return <IconGrid icons={icons} value={v} onChange={setV} label="圖示" labelFor={labelFor} columns={3} />
    }
    render(<Controlled />)
    screen.getByRole('radio', { name: '咖啡' }).focus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('radio', { name: '火車' })).toHaveFocus()
    expect(screen.getByRole('radio', { name: '火車' })).toBeChecked()
  })

  it('gives every cell a full tap target and marks selection with a ring', () => {
    const css = readFileSync(join(import.meta.dirname, 'IconGrid.css'), 'utf8')
    expect(css).toMatch(/\.bi-icon-grid__cell\s*{[^}]*min-height:\s*var\(--bi-tap-min\)/)
    // 選中不靠 accent 填色配前景色（task#71）
    expect(css).not.toMatch(/--bi-accent-fg/)
  })
})
