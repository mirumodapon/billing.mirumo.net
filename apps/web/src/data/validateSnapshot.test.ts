import { describe, expect, it } from 'vitest'
import { defaultSettings } from './defaults'
import { makeExpense, makeTransfer, makeTrip } from './testing/fixtures'
import { APP_ID, SNAPSHOT_VERSION, type Snapshot } from './types'
import { validateSnapshot } from './validateSnapshot'

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    schemaVersion: SNAPSHOT_VERSION,
    exportedAt: '2026-03-20T00:00:00.000Z',
    app: APP_ID,
    settings: defaultSettings(),
    trips: [makeTrip()],
    expenses: [makeExpense()],
    transfers: [makeTransfer()],
    ...overrides,
  }
}

function problemsOf(input: unknown): string[] {
  const result = validateSnapshot(input)
  return result.ok ? [] : result.problems
}

describe('validateSnapshot', () => {
  it('accepts a consistent backup', () => {
    expect(validateSnapshot(snapshot())).toMatchObject({ ok: true })
  })

  it('rejects something that is not a backup at all', () => {
    expect(problemsOf(null)).toEqual(['not a backup file'])
    expect(problemsOf([])).toEqual(['not a backup file'])
    expect(problemsOf({ ...snapshot(), app: 'something-else' })).toContain('not a backup made by this app')
  })

  // 新版本做的備份，舊版本不該假裝看得懂
  it('rejects a version it does not know', () => {
    expect(problemsOf({ ...snapshot(), schemaVersion: SNAPSHOT_VERSION + 1 })).toContain(
      `unsupported backup version ${SNAPSHOT_VERSION + 1}`,
    )
  })

  it('stops at structural problems instead of listing every consequence', () => {
    expect(problemsOf({ ...snapshot(), expenses: 'oops' })).toEqual(['expenses is not a list'])
  })

  /*
   * task#61 的主題：手改過的備份裡，紀錄引用了不在旅程裡的成員。core 的
   * netBalances 會因此讓錢消失（實測 Σ net = −300、+150），而匯入是唯一
   * 繞得過 UI 驗證的入口。
   */
  describe('members that are not in the trip (task#61)', () => {
    it('rejects a payer who is not a member', () => {
      expect(problemsOf(snapshot({ expenses: [makeExpense({ paidBy: 'x' })] }))).toContain(
        'expense e1: member x is not in trip t1',
      )
    })

    it('rejects a participant who is not a member, in every split mode', () => {
      for (const split of [
        { mode: 'even' as const, participants: ['a', 'x'] },
        { mode: 'exact' as const, amounts: { a: 1000, x: 2000 } },
        { mode: 'items' as const, overflowRule: 'prorata' as const, items: [{ id: 'i', name: '', amount: 3000, participants: ['x'] }] },
      ]) {
        expect(problemsOf(snapshot({ expenses: [makeExpense({ split })] })), split.mode).toContain(
          'expense e1: member x is not in trip t1',
        )
      }
    })

    it('rejects a transfer to or from someone outside the trip', () => {
      expect(problemsOf(snapshot({ transfers: [makeTransfer({ from: 'x' })] }))).toContain(
        'transfer x1: member x is not in trip t1',
      )
    })

    // 刪掉紀錄後本來就可以移除成員，墓碑引用已不存在的人是合法狀態
    it('does not hold a deleted record’s references against the trip', () => {
      const tombstone = makeExpense({ paidBy: 'x', deletedAt: '2026-03-18T00:00:00.000Z' })
      expect(validateSnapshot(snapshot({ expenses: [tombstone] }))).toMatchObject({ ok: true })
    })
  })

  it('rejects records for a trip that does not exist', () => {
    expect(problemsOf(snapshot({ expenses: [makeExpense({ tripId: 'ghost' })] }))).toContain(
      'expense e1: trip ghost does not exist',
    )
  })

  it('rejects categories and payment methods that do not exist', () => {
    const problems = problemsOf(snapshot({ expenses: [makeExpense({ categoryId: 'cat.nope', paymentMethodId: 'pay.nope' })] }))
    expect(problems).toContain('expense e1: category cat.nope does not exist')
    expect(problems).toContain('expense e1: payment method pay.nope does not exist')
  })

  // NaN 會讓結算畫面謊稱大家都結清了（task#62 的教訓），Infinity 同理
  it('rejects amounts and rates that are not finite numbers', () => {
    const problems = problemsOf(
      snapshot({ expenses: [makeExpense({ amount: Number.NaN, exchangeRate: 0 })], transfers: [makeTransfer({ amount: Infinity })] }),
    )
    expect(problems).toContain('expense e1: amount is not a number')
    expect(problems).toContain('expense e1: exchange rate must be a positive number')
    expect(problems).toContain('transfer x1: amount is not a number')
  })

  it('rejects impossible dates', () => {
    expect(problemsOf(snapshot({ expenses: [makeExpense({ date: '2026-02-30' })] }))).toContain('expense e1: invalid date')
    expect(problemsOf(snapshot({ trips: [makeTrip({ startDate: '2026-03-20', endDate: '2026-03-10' })] }))).toContain(
      'trip t1: ends before it starts',
    )
  })

  it('rejects a trip whose "me" is not one of its members', () => {
    expect(problemsOf(snapshot({ trips: [makeTrip({ selfMemberId: 'x' })] }))).toContain(
      'trip t1: selfMemberId x is not a member',
    )
  })

  it('rejects duplicated ids', () => {
    const problems = problemsOf(snapshot({ expenses: [makeExpense(), makeExpense()] }))
    expect(problems).toContain('expense id e1 appears more than once')
  })

  it('rejects an unknown split mode', () => {
    const odd = makeExpense({ split: { mode: 'weird' } as never })
    expect(problemsOf(snapshot({ expenses: [odd] }))).toContain('expense e1: unknown split mode weird')
  })

  it('rejects a transfer from someone to themselves', () => {
    expect(problemsOf(snapshot({ transfers: [makeTransfer({ from: 'a', to: 'a' })] }))).toContain(
      'transfer x1: sends money to the same person',
    )
  })

  // UI 要能一次列出所有問題，而不是修一個冒一個
  it('reports every problem at once', () => {
    const problems = problemsOf(
      snapshot({ expenses: [makeExpense({ paidBy: 'x', categoryId: 'cat.nope' })], transfers: [makeTransfer({ to: 'y' })] }),
    )
    expect(problems.length).toBeGreaterThanOrEqual(3)
  })
})

describe('validateSnapshot: trip payment methods (task#92)', () => {
  it('accepts a trip with its own payment methods, and older trips without the field', () => {
    const trip = makeTrip({ paymentMethods: [{ id: 'suica', name: 'Suica' }] })
    expect(validateSnapshot(snapshot({ trips: [trip] }))).toMatchObject({ ok: true })
    expect(validateSnapshot(snapshot({ trips: [makeTrip()] }))).toMatchObject({ ok: true })
  })

  it('rejects malformed or duplicated trip payment methods', () => {
    const malformed = makeTrip({ paymentMethods: [{ id: '', name: 'x' }] })
    expect(problemsOf(snapshot({ trips: [malformed] }))).toContain('trip t1: malformed payment methods')
    const notArray = { ...makeTrip(), paymentMethods: 'suica' } as unknown as ReturnType<typeof makeTrip>
    expect(problemsOf(snapshot({ trips: [notArray] }))).toContain('trip t1: malformed payment methods')
    const twice = makeTrip({ paymentMethods: [{ id: 'suica', name: 'A' }, { id: 'suica', name: 'B' }] })
    expect(problemsOf(snapshot({ trips: [twice] }))).toContain('trip t1: payment method suica appears more than once')
  })
})

describe('validateSnapshot: records using trip payment methods (task#92)', () => {
  // 修正前：只認全域的付款方式，用了旅程專用付款方式的支出讓整份備份匯不進來
  it('accepts an expense paid with one of its trip’s own payment methods', () => {
    const trip = makeTrip({ paymentMethods: [{ id: 'suica', name: 'Suica' }] })
    expect(validateSnapshot(snapshot({ trips: [trip], expenses: [makeExpense({ paymentMethodId: 'suica' })] }))).toMatchObject({ ok: true })
  })

  it('still rejects a payment method that is in neither list', () => {
    expect(problemsOf(snapshot({ expenses: [makeExpense({ paymentMethodId: 'nowhere' })] }))).toContain('expense e1: payment method nowhere does not exist')
  })
})
