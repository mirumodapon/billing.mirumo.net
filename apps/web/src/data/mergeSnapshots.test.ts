import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { mergeSnapshots } from './mergeSnapshots'
import { makeExpense, makeTrip } from './testing/fixtures'
import { APP_ID, SNAPSHOT_VERSION, type Snapshot } from './types'

const base = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  schemaVersion: SNAPSHOT_VERSION,
  exportedAt: '2026-03-20T00:00:00.000Z',
  app: APP_ID,
  settings: defaultSettings(),
  trips: [],
  expenses: [],
  transfers: [],
  ...overrides,
})

describe('mergeSnapshots', () => {
  // 重複匯入同一份備份不能改動任何東西：平手保留本機
  it('keeps the local copy on a tie', () => {
    const local = makeExpense({ description: 'local', updatedAt: '2026-03-15T00:00:00.000Z' })
    const incoming = makeExpense({ description: 'incoming', updatedAt: '2026-03-15T00:00:00.000Z' })
    const merged = mergeSnapshots(base({ expenses: [local] }), base({ expenses: [incoming] }))
    expect(merged.expenses[0]!.description).toBe('local')
  })

  it('takes the incoming copy when it is strictly newer', () => {
    const local = makeTrip({ name: 'local', updatedAt: '2026-03-15T00:00:00.000Z' })
    const incoming = makeTrip({ name: 'incoming', updatedAt: '2026-03-16T00:00:00.000Z' })
    expect(mergeSnapshots(base({ trips: [local] }), base({ trips: [incoming] })).trips[0]!.name).toBe('incoming')
  })

  it('keeps the local settings apart from adding missing categories', () => {
    const local = base({ settings: { ...defaultSettings(), locale: 'en-US' } })
    const incoming = base({ settings: { ...defaultSettings(), locale: 'zh-TW', categories: [...defaultSettings().categories, { id: 'x', name: 'X', icon: 'IconCoin', colorKey: 'accent3', builtin: false }] } })
    const merged = mergeSnapshots(local, incoming)
    expect(merged.settings.locale).toBe('en-US')
    expect(merged.settings.categories.map((c) => c.id)).toContain('x')
    // 已存在的類別不重複
    expect(merged.settings.categories.filter((c) => c.id === 'cat.food')).toHaveLength(1)
  })
})
