import { convertToBaseMinor, type Trip } from '@billing/core'
import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { makeExpense, makeTrip } from '../data/testing/fixtures'
import {
  addItem,
  draftFromExpense,
  exactAllocation,
  isExpenseDraft,
  itemsTotals,
  newDraft,
  previewShares,
  problemsOf,
  toExpense,
  withAutoRate,
  willSaveAsDraft,
  withManualRate,
  type DraftContext,
  type ExpenseDraft,
} from './expenseDraft'

// 三人旅程，本位幣 TWD；日圓有預設匯率與「現金」專屬匯率
const trip: Trip = makeTrip({
  startDate: '2026-03-14',
  endDate: '2026-03-18',
  rates: { default: { JPY: 0.21 }, byMethod: { 'JPY|pay.cash': 0.215 } },
})

function ctx(overrides: Partial<DraftContext> = {}): DraftContext {
  return { trip, expenses: [], settings: defaultSettings(), today: '2026-03-15', ...overrides }
}

/** 一張填好、可以存的草稿 */
function filled(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return { ...newDraft(ctx()), amount: 3000, currency: 'JPY', exchangeRate: 0.21, description: '拉麵', categoryId: 'cat.food', ...overrides }
}

describe('newDraft: defaults (spec 4.4)', () => {
  it('uses the currency of this trip’s latest expense', () => {
    const expenses = [
      makeExpense({ id: 'old', currency: 'USD', createdAt: '2026-03-14T01:00:00.000Z' }),
      makeExpense({ id: 'new', currency: 'JPY', createdAt: '2026-03-15T01:00:00.000Z', date: '2026-03-14' }),
    ]
    const settings = { ...defaultSettings(), lastUsed: { currency: 'KRW' } }
    // 「上一筆」是最後記的那一筆，不是日期最晚的那一筆
    expect(newDraft(ctx({ expenses, settings })).currency).toBe('JPY')
  })

  it('falls back to the last currency used anywhere, then the home currency', () => {
    expect(newDraft(ctx({ settings: { ...defaultSettings(), lastUsed: { currency: 'KRW' } } })).currency).toBe('KRW')
    expect(newDraft(ctx()).currency).toBe('TWD')
  })

  it('ignores deleted expenses when looking for the latest currency', () => {
    const expenses = [makeExpense({ currency: 'USD', createdAt: '2026-03-15T01:00:00.000Z', deletedAt: 'x' })]
    expect(newDraft(ctx({ expenses })).currency).toBe('TWD')
  })

  it('dates the expense today, or the trip’s first day when today is outside the trip', () => {
    expect(newDraft(ctx({ today: '2026-03-16' })).date).toBe('2026-03-16')
    expect(newDraft(ctx({ today: '2026-03-18' })).date).toBe('2026-03-18')
    expect(newDraft(ctx({ today: '2026-03-20' })).date).toBe('2026-03-14')
    expect(newDraft(ctx({ today: '2026-03-01' })).date).toBe('2026-03-14')
  })

  // 類別不帶入（使用者要求）：每一筆都要自己選，上一筆的類別不代表這一筆
  it('leaves the category unchosen but reuses the last payment method', () => {
    const settings = { ...defaultSettings(), lastUsed: { categoryId: 'cat.transport', paymentMethodId: 'pay.credit' } }
    expect(newDraft(ctx({ settings }))).toMatchObject({ categoryId: '', paymentMethodId: 'pay.credit' })
  })

  it('counts a missing category as unfinished, so the form saves a draft', () => {
    expect(problemsOf(filled({ categoryId: '' }))).toContain('categoryRequired')
    expect(problemsOf(filled())).not.toContain('categoryRequired')
  })

  // 上一筆用的自訂類別後來被刪了：不能帶入一個不存在的 id
  it('falls back to the first option when the last one no longer exists', () => {
    const settings = { ...defaultSettings(), lastUsed: { paymentMethodId: 'gone' } }
    expect(newDraft(ctx({ settings }))).toMatchObject({ paymentMethodId: 'pay.cash' })
  })

  it('is paid by me and split evenly among everyone, in member order', () => {
    const d = newDraft(ctx())
    expect(d.paidBy).toBe('a')
    expect(d.split).toEqual({ mode: 'even', participants: ['a', 'b', 'c'] })
  })

  it('starts empty, with no photos and an untouched rate', () => {
    expect(newDraft(ctx())).toMatchObject({ amount: undefined, description: '', attachments: [], rateTouched: false })
  })
})

describe('newDraft: trip payment methods (task#92)', () => {
  it('reuses a trip-only payment method as the last one used', () => {
    const withSuica = { ...trip, paymentMethods: [{ id: 'suica', name: 'Suica' }] }
    const settings = { ...defaultSettings(), lastUsed: { paymentMethodId: 'suica' } }
    expect(newDraft({ ...ctx({ settings }), trip: withSuica }).paymentMethodId).toBe('suica')
    // 另一趟旅程沒有這個付款方式：退回第一個
    expect(newDraft(ctx({ settings })).paymentMethodId).toBe('pay.cash')
  })
})

describe('exchange rate (spec 4.4, 2.5)', () => {
  it('takes the rate for the currency and payment method first', () => {
    const settings = { ...defaultSettings(), lastUsed: { currency: 'JPY', paymentMethodId: 'pay.cash' } }
    expect(newDraft(ctx({ settings })).exchangeRate).toBe(0.215)
  })

  it('then the currency’s default rate', () => {
    const settings = { ...defaultSettings(), lastUsed: { currency: 'JPY', paymentMethodId: 'pay.credit' } }
    expect(newDraft(ctx({ settings })).exchangeRate).toBe(0.21)
  })

  it('then leaves it blank for the user to fill in', () => {
    const settings = { ...defaultSettings(), lastUsed: { currency: 'KRW' } }
    expect(newDraft(ctx({ settings })).exchangeRate).toBeUndefined()
  })

  it('is 1 for the home currency', () => {
    expect(newDraft(ctx()).exchangeRate).toBe(1)
  })

  it('follows a change of payment method or currency', () => {
    const d = filled({ paymentMethodId: 'pay.credit' })
    expect(withAutoRate({ ...d, paymentMethodId: 'pay.cash' }, trip).exchangeRate).toBe(0.215)
    expect(withAutoRate({ ...d, currency: 'TWD' }, trip).exchangeRate).toBe(1)
  })

  it('stops following once the user sets it by hand', () => {
    const d = withManualRate(filled({ paymentMethodId: 'pay.credit' }), 0.2)
    expect(d.rateTouched).toBe(true)
    expect(withAutoRate({ ...d, paymentMethodId: 'pay.cash' }, trip).exchangeRate).toBe(0.2)
  })

  // Plan 7 E4：打開舊帳改個說明，不能順便把匯率換成今天的表
  it('treats an existing expense’s rate as set by hand', () => {
    const d = draftFromExpense(makeExpense({ exchangeRate: 0.19, paymentMethodId: 'pay.credit' }))
    expect(withAutoRate({ ...d, paymentMethodId: 'pay.cash' }, trip).exchangeRate).toBe(0.19)
  })
})

describe('problemsOf (Plan 7 E6)', () => {
  it('accepts a complete draft', () => {
    expect(problemsOf(filled())).toEqual([])
  })

  it('needs an amount above zero', () => {
    expect(problemsOf(filled({ amount: undefined }))).toContain('amountRequired')
    expect(problemsOf(filled({ amount: 0 }))).toContain('amountRequired')
    expect(problemsOf(filled({ amount: -5 }))).toContain('amountRequired')
  })

  it('needs a description that is more than spaces', () => {
    expect(problemsOf(filled({ description: '   ' }))).toContain('descriptionRequired')
  })

  it('needs a rate', () => {
    expect(problemsOf(filled({ exchangeRate: undefined }))).toContain('rateRequired')
  })

  it('needs at least one person to share an even split', () => {
    expect(problemsOf(filled({ split: { mode: 'even', participants: [] } }))).toContain('noParticipants')
  })

  // 規格 4.4：指定金額未對齊時儲存鍵停用
  it('needs exact amounts to add up to the total, to the last minor unit', () => {
    const usd = (amounts: Record<string, number | undefined>) =>
      filled({ currency: 'USD', exchangeRate: 32, amount: 0.3, split: { mode: 'exact', amounts } })
    // 0.1 + 0.2 在浮點下不等於 0.3，但金額上相等：比較的是最小單位
    expect(problemsOf(usd({ a: 0.1, b: 0.2 }))).toEqual([])
    expect(problemsOf(usd({ a: 0.1, b: 0.19 }))).toContain('exactUnbalanced')
  })

  it('needs at least one line item, each with an amount and someone to share it', () => {
    const items = (list: ExpenseDraft['split']) => problemsOf(filled({ split: list }))
    expect(items({ mode: 'items', items: [], overflowRule: 'prorata' })).toContain('noItems')
    expect(items({ mode: 'items', items: [{ id: 'i', name: '', amount: 100, participants: [] }], overflowRule: 'prorata' })).toContain(
      'itemWithoutParticipants',
    )
    expect(items({ mode: 'items', items: [{ id: 'i', name: '', amount: undefined, participants: ['a'] }], overflowRule: 'prorata' })).toContain(
      'itemWithoutAmount',
    )
  })

  // 明細與總額不必相等：差額自動攤回（規格 3.3）
  it('accepts line items that do not add up to the total', () => {
    const split = { mode: 'items' as const, items: [{ id: 'i', name: '', amount: 2000, participants: ['a'] }], overflowRule: 'prorata' as const }
    expect(problemsOf(filled({ split }))).toEqual([])
  })
})

describe('allocation totals', () => {
  it('reports how much of the total exact amounts cover', () => {
    const d = filled({ amount: 3000, split: { mode: 'exact', amounts: { a: 1000, b: 1500, c: undefined } } })
    expect(exactAllocation(d)).toEqual({ allocated: 2500, remaining: 500 })
    const over = filled({ amount: 3000, split: { mode: 'exact', amounts: { a: 2000, b: 1500 } } })
    expect(exactAllocation(over)).toEqual({ allocated: 3500, remaining: -500 })
  })

  it('reports the line-item subtotal and the difference to pay back, either way', () => {
    const items = (amounts: number[]) =>
      filled({
        amount: 3800,
        split: { mode: 'items', items: amounts.map((amount, i) => ({ id: `i${i}`, name: '', amount, participants: ['a'] })), overflowRule: 'prorata' },
      })
    expect(itemsTotals(items([1700, 1000, 700]))).toEqual({ itemsTotal: 3400, overflow: 400 })
    // 折價券：明細比實付多，差額為負（規格 3.3）
    expect(itemsTotals(items([2000, 2200]))).toEqual({ itemsTotal: 4200, overflow: -400 })
  })
})

describe('toExpense', () => {
  it('fixes the rate into the record and leaves the timestamps to the repository', () => {
    const e = toExpense(filled({ exchangeRate: 0.213 }), 't1')
    expect(e).toMatchObject({ tripId: 't1', amount: 3000, currency: 'JPY', exchangeRate: 0.213, description: '拉麵', createdAt: '', updatedAt: '' })
    expect(e.id).toBeTruthy()
  })

  it('keeps the id of an existing expense', () => {
    const d = draftFromExpense(makeExpense({ id: 'e9' }))
    expect(toExpense(d, 't1').id).toBe('e9')
  })

  it('stores only the members who were given an exact amount', () => {
    const e = toExpense(filled({ amount: 3000, split: { mode: 'exact', amounts: { a: 3000, b: 0, c: undefined } } }), 't1')
    expect(e.split).toEqual({ mode: 'exact', amounts: { a: 3000 } })
  })

  // 顯示時才補「品項 N」，存的是使用者真的輸入的東西
  it('stores blank item names as they are', () => {
    const split = { mode: 'items' as const, items: [{ id: 'i1', name: '', amount: 3000, participants: ['a', 'b'] }], overflowRule: 'even' as const }
    expect(toExpense(filled({ split }), 't1').split).toEqual({
      mode: 'items',
      items: [{ id: 'i1', name: '', amount: 3000, participants: ['a', 'b'] }],
      overflowRule: 'even',
    })
  })

  it('trims the description', () => {
    expect(toExpense(filled({ description: '  拉麵 ' }), 't1').description).toBe('拉麵')
  })

  it('round-trips an existing expense unchanged', () => {
    const original = makeExpense({
      split: { mode: 'items', items: [{ id: 'i1', name: '煎餃', amount: 480, participants: ['a'] }], overflowRule: 'prorata' },
      attachments: [{ id: 'p1', mimeType: 'image/webp', byteSize: 1, width: 1, height: 1 }],
    })
    const again = toExpense(draftFromExpense(original), 't1')
    expect({ ...again, createdAt: original.createdAt, updatedAt: original.updatedAt }).toEqual(original)
  })
})

describe('previewShares', () => {
  it('splits through core so the shares add up to the converted total', () => {
    const d = filled({ amount: 1000, exchangeRate: 0.21 })
    const shares = previewShares(d, trip)!
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(convertToBaseMinor(1000, 0.21, 'TWD'))
  })

  it('has nothing to show without an amount or a rate', () => {
    expect(previewShares(filled({ amount: undefined }), trip)).toBeUndefined()
    expect(previewShares(filled({ exchangeRate: undefined }), trip)).toBeUndefined()
  })

  // 規格 3.3 的例子：小計 3,400，實付 3,800，差額按比例攤回
  it('pays the line-item difference back by share', () => {
    const d = filled({
      amount: 3800,
      currency: 'TWD',
      exchangeRate: 1,
      split: {
        mode: 'items',
        overflowRule: 'prorata',
        items: [
          { id: 'i1', name: '', amount: 1700, participants: ['a'] },
          { id: 'i2', name: '', amount: 1000, participants: ['b'] },
          { id: 'i3', name: '', amount: 700, participants: ['c'] },
        ],
      },
    })
    expect(previewShares(d, trip)).toEqual({ a: 1900, b: 1118, c: 782 })
  })
})

describe('addItem (spec 4.4)', () => {
  it('starts the first item with everyone', () => {
    const d = addItem(filled({ split: { mode: 'items', items: [], overflowRule: 'prorata' } }), trip)
    expect(d.split.mode === 'items' && d.split.items).toEqual([expect.objectContaining({ name: '', amount: undefined, participants: ['a', 'b', 'c'] })])
  })

  // 連續點餐多半同一群人
  it('copies the previous item’s people into the next one', () => {
    const start = filled({ split: { mode: 'items', items: [{ id: 'i1', name: '', amount: 100, participants: ['a', 'c'] }], overflowRule: 'prorata' } })
    const d = addItem(start, trip)
    expect(d.split.mode === 'items' && d.split.items[1]?.participants).toEqual(['a', 'c'])
    expect(d.split.mode === 'items' && d.split.items[1]?.id).not.toBe('i1')
  })
})

describe('isExpenseDraft', () => {
  it('accepts every draft the form can produce', () => {
    const items = filled({ split: { mode: 'items', items: [{ id: 'i', name: '', amount: undefined, participants: ['a'] }], overflowRule: 'even' } })
    for (const d of [newDraft(ctx()), filled(), filled({ split: { mode: 'exact', amounts: { a: 1, b: undefined } } }), items]) {
      expect(isExpenseDraft(d)).toBe(true)
    }
  })

  // 舊版存的形狀或寫到一半的資料：當作沒有草稿，不能把表單弄壞
  it.each([
    null,
    'draft',
    {},
    { ...newDraft(ctx()), amount: 'x' },
    { ...newDraft(ctx()), amount: Number.NaN },
    { ...newDraft(ctx()), description: undefined },
    { ...newDraft(ctx()), rateTouched: 'yes' },
    { ...newDraft(ctx()), isDraft: 'yes' },
    { ...newDraft(ctx()), split: { mode: 'even' } },
    { ...newDraft(ctx()), split: { mode: 'items', items: [{ id: 'i' }], overflowRule: 'prorata' } },
    { ...newDraft(ctx()), split: { mode: 'items', items: [], overflowRule: 'sideways' } },
    { ...newDraft(ctx()), split: { mode: 'magic' } },
  ])('rejects %j', (value) => {
    expect(isExpenseDraft(value)).toBe(false)
  })
})

describe('drafts (task#96)', () => {
  it('saves an unfinished form as a draft, with 0 for what is missing', () => {
    const e = toExpense(filled({ amount: undefined, exchangeRate: undefined }), 't1')
    expect(e).toMatchObject({ draft: true, amount: 0, exchangeRate: 0 })
  })

  it('reopens a draft with the missing amount and rate unset, so the rate is filled in again', () => {
    const d = draftFromExpense(makeExpense({ draft: true, amount: 0, exchangeRate: 0 }))
    expect(d).toMatchObject({ amount: undefined, exchangeRate: undefined, rateTouched: false, isDraft: true })
    expect(withAutoRate(d, trip).exchangeRate).toBe(0.215)
  })

  // 完成的一筆若金額真的是 0（例如招待），不能被當成「未填」
  it('keeps a real zero on a finished expense', () => {
    expect(draftFromExpense(makeExpense({ amount: 0 })).amount).toBe(0)
  })

  it('saves a finished form as a draft when asked to', () => {
    const d = filled({ isDraft: true })
    expect(willSaveAsDraft(d)).toBe(true)
    expect(toExpense(d, 't1').draft).toBe(true)
  })

  it('saves a finished form as a real expense, with no draft key', () => {
    expect(willSaveAsDraft(filled())).toBe(false)
    expect(toExpense(filled(), 't1')).not.toHaveProperty('draft')
  })

  it('forces a draft while fields are missing, whatever the toggle says', () => {
    expect(willSaveAsDraft(filled({ isDraft: false, description: '' }))).toBe(true)
  })

  it('turns a finished draft into a real expense when the toggle is switched off', () => {
    const d = draftFromExpense(makeExpense({ draft: true }))
    expect(toExpense({ ...d, isDraft: false }, 't1')).not.toHaveProperty('draft')
  })
})

describe('stored-value cards (task#115)', () => {
  const stored = new Set(['suica'])

  it('marks a payment made with a stored-value card as drawn from its balance', () => {
    expect(toExpense(filled({ paymentMethodId: 'suica' }), 't1', stored).fromBalance).toBe(true)
    expect(toExpense(filled({ paymentMethodId: 'pay.cash' }), 't1', stored)).not.toHaveProperty('fromBalance')
  })

  it('keeps which card a top-up is for, and a top-up is a real expense', () => {
    const e = toExpense(filled({ paymentMethodId: 'pay.credit', topUpFor: 'suica' }), 't1', stored)
    expect(e.topUpFor).toBe('suica')
    expect(e).not.toHaveProperty('fromBalance')
  })

  it('round-trips the top-up target through the form', () => {
    const d = draftFromExpense(makeExpense({ topUpFor: 'suica' }))
    expect(d.topUpFor).toBe('suica')
    expect(isExpenseDraft(d)).toBe(true)
    expect(isExpenseDraft({ ...d, topUpFor: 3 })).toBe(false)
  })
})
