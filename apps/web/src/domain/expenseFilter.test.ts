import { describe, expect, it } from 'vitest'
import { makeExpense } from '../data/testing/fixtures'
import { EMPTY_FILTER, filterExpenses, isFilterActive, toggleIn, usedIds } from './expenseFilter'

const ramen = makeExpense({ id: 'ramen', categoryId: 'cat.food', paidBy: 'a', paymentMethodId: 'pay.cash' })
const taxi = makeExpense({ id: 'taxi', categoryId: 'cat.transport', paidBy: 'b', paymentMethodId: 'pay.credit' })
const pending = makeExpense({ id: 'pending', categoryId: 'cat.food', paidBy: 'b', paymentMethodId: 'pay.cash', draft: true })
const all = [ramen, taxi, pending]
const ids = (list: { id: string }[]) => list.map((e) => e.id)

describe('filterExpenses (task#106)', () => {
  it('keeps everything with no filter', () => {
    expect(ids(filterExpenses(all, EMPTY_FILTER))).toEqual(['ramen', 'taxi', 'pending'])
    expect(isFilterActive(EMPTY_FILTER)).toBe(false)
  })

  it('matches any of the chosen values within one dimension', () => {
    expect(ids(filterExpenses(all, { ...EMPTY_FILTER, categoryIds: ['cat.food', 'cat.transport'] }))).toEqual(['ramen', 'taxi', 'pending'])
    expect(ids(filterExpenses(all, { ...EMPTY_FILTER, payers: ['b'] }))).toEqual(['taxi', 'pending'])
    expect(ids(filterExpenses(all, { ...EMPTY_FILTER, paymentMethodIds: ['pay.credit'] }))).toEqual(['taxi'])
  })

  it('requires every dimension that has a choice', () => {
    expect(ids(filterExpenses(all, { ...EMPTY_FILTER, categoryIds: ['cat.food'], payers: ['b'] }))).toEqual(['pending'])
  })

  it('shows only drafts when asked', () => {
    const f = { ...EMPTY_FILTER, draftsOnly: true }
    expect(ids(filterExpenses(all, f))).toEqual(['pending'])
    expect(isFilterActive(f)).toBe(true)
  })

  it('counts any choice as an active filter', () => {
    expect(isFilterActive({ ...EMPTY_FILTER, paymentMethodIds: ['pay.cash'] })).toBe(true)
  })
})

describe('helpers', () => {
  it('toggles a value in and out of a list', () => {
    expect(toggleIn(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleIn(['a', 'b'], 'a')).toEqual(['b'])
  })

  // 篩選面板只列這趟旅程真的用過的，外加已選但現在沒有支出的（不然選了就取消不掉）
  it('lists the ids in use, keeping chosen ones that are no longer used', () => {
    expect(usedIds(all, (e) => e.categoryId, ['cat.hotel'])).toEqual(new Set(['cat.food', 'cat.transport', 'cat.hotel']))
  })
})
