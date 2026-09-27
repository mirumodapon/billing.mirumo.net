import { describe, expect, it } from 'vitest'
import { setLocale } from '../i18n'
import { displayName } from './names'

describe('displayName', () => {
  it('translates built-in items in the current language', () => {
    setLocale('zh-TW')
    expect(displayName({ id: 'pay.cash', builtin: true })).toBe('現金')
    setLocale('en-US')
    expect(displayName({ id: 'pay.cash', builtin: true })).toBe('Cash')
  })

  it('shows a custom item exactly as the user typed it, in any language', () => {
    setLocale('en-US')
    expect(displayName({ id: 'x1', name: '悠遊卡', builtin: false })).toBe('悠遊卡')
  })
})
