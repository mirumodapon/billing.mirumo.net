import { afterEach, describe, expect, it, vi } from 'vitest'
import { todayIso } from './dates'

afterEach(() => vi.useRealTimers())

describe('todayIso', () => {
  // 使用者的「今天」是當地日期；用 toISOString 的話，台灣早上八點前會變成昨天
  it('uses the local date, not the UTC one', () => {
    vi.useFakeTimers()
    // 測試跑在 America/Los_Angeles：當地 3/14 晚上 20:00 在 UTC 已經是 3/15
    vi.setSystemTime(new Date('2026-03-15T03:00:00Z'))
    expect(todayIso()).toBe('2026-03-14')
  })
})
