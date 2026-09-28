import type { Trip } from '@billing/core'
import { cleanup, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession, readSession, writeSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const plain = (s: string) => s.replace(/\s+/g, ' ')

/** 與 statsView.test 同一個手算情境：全團 4,200、我 1,000 */
async function setup(trip: Partial<Trip> = {}) {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW' })
  await stores.repo.saveTrip(makeTrip({ id: 't1', startDate: '2026-03-14', endDate: '2026-03-16', ...trip }))
  await stores.repo.saveExpense(
    makeExpense({ id: 'e1', tripId: 't1', date: '2026-03-14', description: '晚餐', paidBy: 'a', amount: 3000, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.food', split: { mode: 'even', participants: ['a', 'b', 'c'] } }),
  )
  await stores.repo.saveExpense(
    makeExpense({ id: 'e2', tripId: 't1', date: '2026-03-15', description: '地鐵', paidBy: 'b', amount: 1200, currency: 'TWD', exchangeRate: 1, categoryId: 'cat.transport', split: { mode: 'even', participants: ['b', 'c'] } }),
  )
  const app = await renderApp('/trip/t1/stats', stores)
  return { ...app, scope: () => within(screen.getByRole('radiogroup', { name: t('stats.scope') })) }
}

const total = () => screen.getByTestId('stats-total')

describe('StatsTab: scope (spec 4.5, Plan 9 T1)', () => {
  it('starts on the group, the same figure as the expense list', async () => {
    const { scope } = await setup()
    expect(scope().getByRole('radio', { name: t('stats.group') })).toBeChecked()
    expect(total()).toHaveTextContent(plain(t('stats.total', { amount: formatMoney(4200, 'TWD') })))
  })

  it('switches to my share and remembers it', async () => {
    const { user, scope, stores } = await setup()
    await user.click(scope().getByRole('radio', { name: t('stats.memberSelf', { name: '阿明' }) }))
    expect(total()).toHaveTextContent(plain(t('stats.total', { amount: formatMoney(1000, 'TWD') })))
    expect(readSession()?.statsScope).toBe('self')
    cleanup()
    await renderApp('/trip/t1/stats', stores)
    expect(within(screen.getByRole('radiogroup', { name: t('stats.scope') })).getByRole('radio', { name: t('stats.memberSelf', { name: '阿明' }) })).toBeChecked()
  })
})

describe('StatsTab: overview, categories, daily (Plan 9 Task 3)', () => {
  it('shows the budget in its own scope, with what is left', async () => {
    await setup({ budget: { total: 5000, scope: 'group' } })
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByTestId('stats-budget')).toHaveTextContent(
      plain(t('stats.budget', { scope: t('stats.group'), budget: formatMoney(5000, 'TWD'), remaining: formatMoney(800, 'TWD') })),
    )
  })

  // 規格 3.6：沒設預算就什麼都不畫
  it('draws no budget at all when none is set', async () => {
    await setup()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stats-budget')).not.toBeInTheDocument()
  })

  it('lists each category with its amount', async () => {
    await setup()
    const donut = within(screen.getByRole('figure', { name: t('stats.categories') }))
    expect(donut.getByText(t('cat.food')).closest('li')).toHaveTextContent(plain(formatMoney(3000, 'TWD')))
    expect(donut.getByText(t('cat.transport')).closest('li')).toHaveTextContent(plain(formatMoney(1200, 'TWD')))
  })

  it('has a bar per trip day and flags days over the daily budget', async () => {
    await setup({ budget: { daily: 2000, scope: 'group' } })
    const daily = within(screen.getByRole('figure', { name: t('stats.daily') }))
    expect(daily.getAllByRole('row')).toHaveLength(3)
    expect(daily.getByTestId('budget-line')).toBeInTheDocument()
    expect(daily.getAllByText(t('stats.overBudget'))).toHaveLength(1)
    // 刻度寫精簡數字，不帶幣別符號：44px 的刻度欄放不下「NT$2,000」
    const ticks = [...document.querySelectorAll('.bi-bar__tick')].map((n) => n.textContent)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.some((tick) => tick?.includes('$'))).toBe(false)
  })

  // Plan 9 T3：拿「我」的花費比全團的每日預算是錯的警示
  it('leaves out the daily budget line in the other scope', async () => {
    const { user, scope } = await setup({ budget: { daily: 2000, scope: 'group' } })
    await user.click(scope().getByRole('radio', { name: t('stats.memberSelf', { name: '阿明' }) }))
    expect(within(screen.getByRole('figure', { name: t('stats.daily') })).queryByTestId('budget-line')).not.toBeInTheDocument()
  })

  it('remembers a collapsed section across a restart', async () => {
    const { user, stores } = await setup()
    const header = () => screen.getByRole('button', { name: new RegExp(`^${t('stats.categories')}`) })
    expect(header()).toHaveAttribute('aria-expanded', 'true')
    await user.click(header())
    expect(header()).toHaveAttribute('aria-expanded', 'false')
    cleanup()
    await renderApp('/trip/t1/stats', stores)
    expect(header()).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('StatsTab: members and my items (Plan 9 Task 4)', () => {
  it('compares members for the group, the largest filling the bar', async () => {
    await setup()
    const rows = within(screen.getByTestId('stats-members-panel')).getAllByTestId('stats-member')
    const expected: [string, number][] = [
      ['阿明', 1000],
      ['小美', 1600],
      ['大熊', 1600],
    ]
    expected.forEach(([name, minor], i) => {
      expect(within(rows[i]!).getByText(name)).toBeInTheDocument()
      expect(rows[i]).toHaveTextContent(plain(formatMoney(minor, 'TWD')))
    })
    const widths = rows.map((r) => r.querySelector<HTMLElement>('.app-share__bar > span')!.style.width)
    expect(widths[1]).toBe('100%')
    expect(Number.parseFloat(widths[0]!)).toBeCloseTo(62.5)
    expect(screen.queryByTestId('stats-items')).not.toBeInTheDocument()
  })

  it('lists what I shared in, largest first, with the service charge on its own line', async () => {
    const { user, stores } = await setup()
    await stores.repo.saveExpense(
      makeExpense({
        id: 'e3',
        tripId: 't1',
        date: '2026-03-16',
        description: '居酒屋',
        amount: 1100,
        currency: 'TWD',
        exchangeRate: 1,
        split: { mode: 'items', overflowRule: 'prorata', items: [{ id: 'i1', name: '生啤', amount: 1000, participants: ['a', 'b'] }] },
      }),
    )
    cleanup()
    await renderApp('/trip/t1/stats', stores)
    await user.click(within(screen.getByRole('radiogroup', { name: t('stats.scope') })).getByRole('radio', { name: t('stats.memberSelf', { name: '阿明' }) }))
    const items = within(screen.getByTestId('stats-items-panel'))
    expect(items.getAllByTestId('stats-item').map((r) => r.firstChild?.firstChild?.textContent)).toEqual(['晚餐', '生啤'])
    expect(items.getByTestId('stats-overflow')).toHaveTextContent(plain(formatMoney(50, 'TWD')))
    expect(screen.queryByTestId('stats-members')).not.toBeInTheDocument()
  })
})

describe('StatsTab: from any member (per-member stats)', () => {
  it('shows another member’s share and what they shared in, and remembers who', async () => {
    const { user, scope, stores } = await setup()
    await user.click(scope().getByRole('radio', { name: '小美' }))
    expect(total()).toHaveTextContent(plain(t('stats.total', { amount: formatMoney(1600, 'TWD') })))
    expect(screen.getByRole('button', { name: new RegExp(`^${t('stats.memberItems', { name: '小美' })}`) })).toBeInTheDocument()
    expect(readSession()).toMatchObject({ statsScope: 'self', statsMember: 'b' })
    cleanup()
    await renderApp('/trip/t1/stats', stores)
    expect(within(screen.getByRole('radiogroup', { name: t('stats.scope') })).getByRole('radio', { name: '小美' })).toBeChecked()
  })

  // 記住的成員被移除（或是別趟旅程的人）時，不能壞掉：退回我自己
  it('falls back to me when the remembered member is not in this trip', async () => {
    writeSession({ route: '/trip/t1/stats', statsScope: 'self', statsMember: 'gone' })
    const { scope } = await setup()
    expect(scope().getByRole('radio', { name: t('stats.memberSelf', { name: '阿明' }) })).toBeChecked()
    expect(total()).toHaveTextContent(plain(t('stats.total', { amount: formatMoney(1000, 'TWD') })))
  })
})
