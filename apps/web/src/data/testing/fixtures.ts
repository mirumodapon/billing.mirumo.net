import type { Expense, Transfer, Trip } from '@billing/core'

/**
 * 測試用的建構函式。只放在 testing/ 底下：app 的建置 tsconfig 排除了這個目錄，
 * 根層級的 tsconfig.tests.json 仍然會檢查它的型別。
 */

/** 每個測試一個獨立的資料庫名稱，彼此不會看到對方的資料 */
export function freshDbName(): string {
  return `test-${crypto.randomUUID()}`
}

/** 一個會一直往前走的假時鐘：每呼叫一次前進一秒，時間戳才分得出先後 */
export function tickingClock(start = '2026-03-15T00:00:00.000Z') {
  let ms = Date.parse(start)
  return () => {
    const iso = new Date(ms).toISOString()
    ms += 1000
    return iso
  }
}

export function makeTrip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    name: '東京五日',
    destination: '東京',
    startDate: '2026-03-14',
    endDate: '2026-03-18',
    baseCurrency: 'TWD',
    members: [
      { id: 'a', name: '阿明', colorKey: 'accent1' },
      { id: 'b', name: '小美', colorKey: 'accent4' },
      { id: 'c', name: '大熊', colorKey: 'accent8' },
    ],
    selfMemberId: 'a',
    budget: { scope: 'group' },
    rates: { default: { JPY: 0.21 }, byMethod: {} },
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

export function makeExpense(overrides: Partial<Expense> = {}): Expense {
  return {
    id: 'e1',
    tripId: 't1',
    date: '2026-03-15',
    description: '一蘭拉麵',
    categoryId: 'cat.food',
    paymentMethodId: 'pay.cash',
    paidBy: 'a',
    amount: 3000,
    currency: 'JPY',
    exchangeRate: 0.21,
    split: { mode: 'even', participants: ['a', 'b', 'c'] },
    attachments: [],
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

export function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 'x1',
    tripId: 't1',
    date: '2026-03-16',
    from: 'b',
    to: 'a',
    amount: 500,
    currency: 'TWD',
    exchangeRate: 1,
    kind: 'settlement',
    note: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}
