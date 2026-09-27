import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AvatarToggleGroup } from './AvatarToggleGroup'

const items = [
  { value: 'a', name: '阿明', colorKey: 'accent1' },
  { value: 'b', name: '小美', colorKey: 'accent2' },
  { value: 'c', name: '大熊', colorKey: 'accent3' },
]

describe('AvatarToggleGroup', () => {
  it('is a named group of toggle buttons', () => {
    render(<AvatarToggleGroup items={items} selected={['a']} onChange={vi.fn()} label="參與者" />)
    expect(screen.getByRole('group', { name: '參與者' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '阿明' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '小美' })).toHaveAttribute('aria-pressed', 'false')
  })

  /*
   * 按鈕裡同時有頭像（role=img，名稱是姓名）與姓名文字。文字若沒有對輔助科技
   * 隱藏，按鈕的名稱會變成「阿明 阿明」，每一位成員都被念兩次。
   */
  it('names each button once, not twice', () => {
    render(<AvatarToggleGroup items={items} selected={[]} onChange={vi.fn()} label="參與者" />)
    expect(screen.getByRole('button', { name: '阿明' })).toHaveAccessibleName('阿明')
  })

  it('adds a member when pressed', async () => {
    const onChange = vi.fn()
    render(<AvatarToggleGroup items={items} selected={['a']} onChange={onChange} label="參與者" />)
    await userEvent.click(screen.getByRole('button', { name: '大熊' }))
    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
  })

  it('removes a member when pressed again', async () => {
    const onChange = vi.fn()
    render(<AvatarToggleGroup items={items} selected={['a', 'b']} onChange={onChange} label="參與者" />)
    await userEvent.click(screen.getByRole('button', { name: '阿明' }))
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  // 結果依項目順序而非點擊順序，呼叫端比對與儲存都不必再排序
  it('reports the selection in item order, not click order', async () => {
    const onChange = vi.fn()
    render(<AvatarToggleGroup items={items} selected={['c']} onChange={onChange} label="參與者" />)
    await userEvent.click(screen.getByRole('button', { name: '阿明' }))
    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
  })

  // 均分至少要一個人；把最後一個也取消會讓這筆支出沒有人分攤
  it('refuses to drop below the minimum', async () => {
    const onChange = vi.fn()
    render(
      <AvatarToggleGroup items={items} selected={['a']} onChange={onChange} label="參與者" minSelected={1} />,
    )
    await userEvent.click(screen.getByRole('button', { name: '阿明' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('draws unselected members outlined', () => {
    render(<AvatarToggleGroup items={items} selected={['a']} onChange={vi.fn()} label="參與者" />)
    expect(screen.getByRole('img', { name: '小美' })).toHaveAttribute('data-outlined', 'true')
    expect(screen.getByRole('img', { name: '阿明' })).not.toHaveAttribute('data-outlined')
  })

  it('scrolls sideways and gives each member a full tap target', () => {
    const css = readFileSync(join(import.meta.dirname, 'AvatarToggleGroup.css'), 'utf8')
    expect(css).toMatch(/\.bi-avatar-toggle\s*{[^}]*overflow-x:\s*auto/)
    expect(css).toMatch(/\.bi-avatar-toggle__item\s*{[^}]*min-width:\s*var\(--bi-tap-min\)/)
  })
})
