import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('shows the first character of the name', () => {
    render(<Avatar name="阿明" />)
    expect(screen.getByText('阿')).toBeInTheDocument()
  })

  // name[0] 會把代理對切成半個字元、顯示成亂碼方塊。Array.from 才是按字元切
  it('does not split a surrogate pair', () => {
    render(<Avatar name="𠮷田" />)
    expect(screen.getByText('𠮷')).toBeInTheDocument()
  })

  it('exposes the full name to assistive tech', () => {
    render(<Avatar name="阿明" />)
    expect(screen.getByLabelText('阿明')).toBeInTheDocument()
  })

  it('renders an empty name without crashing', () => {
    render(<Avatar name="" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  // 沒帶 colorKey 時必須落在一個真的槽位上。若預設值消失，這裡會算出
  // var(--bi-) —— 一個無效的 custom property，背景整個不見，而且因為
  // CSS 不會報錯，只有肉眼看得出來
  it('falls back to a real accent slot when no colour is given', () => {
    render(<Avatar name="阿明" />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-color': 'var(--bi-accent8)' })
  })

  it('applies the colour slot', () => {
    render(<Avatar name="阿明" colorKey="accent5" />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-color': 'var(--bi-accent5)' })
  })

  // 這是這個元件與 brief 版本分歧的地方:outlined 要留住顏色身分,
  // 不能像 brief 那樣退回 --bi-text-muted。詳見 Avatar.css 的註解。
  it('keeps the colour identity when outlined', () => {
    render(<Avatar name="阿明" colorKey="accent5" outlined />)
    expect(screen.getByRole('img')).toHaveStyle({ '--bi-avatar-color': 'var(--bi-accent5)' })
  })

  it('marks the outlined variant for the toggle group to style', () => {
    render(<Avatar name="阿明" outlined />)
    expect(screen.getByRole('img')).toHaveAttribute('data-outlined', 'true')
  })
})
