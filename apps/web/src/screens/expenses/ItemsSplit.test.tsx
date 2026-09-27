import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t, tPlural } from '../../i18n'
import { currentRoute, makeStores, renderApp } from '../../test/renderApp'

beforeEach(() => clearSession())

const plain = (s: string) => s.replace(/\s+/g, ' ')

async function openItems(total: string[]) {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW', lastUsed: { currency: 'TWD' } })
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD' }))
  const app = await renderApp('/trip/t1/expense/new', stores)
  const key = (name: string) => screen.getByRole('button', { name })
  for (const d of total) await app.user.click(key(d))
  await app.user.click(key(t('keypad.done')))
  const header = () => screen.getByRole('button', { name: new RegExp(`^${t('split.title')}`) })
  await app.user.click(header())
  const panel = () => within(screen.getByTestId('section-split-panel'))
  await app.user.click(panel().getByRole('radio', { name: t('split.items') }))
  async function addItem(amount: string[]) {
    await app.user.click(panel().getByRole('button', { name: t('split.addItem') }))
    const n = panel().getAllByRole('button', { name: /的金額/ }).length
    await app.user.click(panel().getByRole('button', { name: new RegExp(`^${t('split.itemAmount', { name: t('split.itemPlaceholder', { n }) })}`) }))
    for (const d of amount) await app.user.click(key(d))
    await app.user.click(key(t('keypad.done')))
  }
  const people = (n: number) => within(panel().getByRole('group', { name: t('split.itemPeople', { name: t('split.itemPlaceholder', { n }) }) }))
  return { ...app, header, panel, key, addItem, people }
}

describe('ItemsSplit', () => {
  // 規格 4.4：連續點餐多半同一群人
  it('starts each new item with the previous item’s people', async () => {
    const { user, addItem, people } = await openItems(['3', '0', '0', '0'])
    await addItem(['1', '2', '0', '0'])
    expect(people(1).getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')).toHaveLength(3)
    await user.click(people(1).getByRole('button', { name: '大熊' }))
    await addItem(['4', '8', '0'])
    expect(people(2).getByRole('button', { name: '大熊' })).toHaveAttribute('aria-pressed', 'false')
    expect(people(2).getByRole('button', { name: '阿明' })).toHaveAttribute('aria-pressed', 'true')
  })

  // 規格 3.3：明細加總與總額之間的差額（服務費、折價券）
  it('shows the difference to pay back, and how to split it', async () => {
    const { panel, addItem } = await openItems(['3', '8', '0', '0'])
    await addItem(['3', '4', '0', '0'])
    expect(panel().getByRole('status')).toHaveTextContent(plain(t('split.overflow', { amount: formatMoney(400, 'TWD') })))
    expect(panel().getByRole('radiogroup', { name: t('split.overflowRule') })).toBeInTheDocument()
  })

  it('handles a discount the same way', async () => {
    const { panel, addItem } = await openItems(['3', '4', '0', '0'])
    await addItem(['3', '8', '0', '0'])
    expect(panel().getByRole('status')).toHaveTextContent(plain(t('split.overflow', { amount: formatMoney(-400, 'TWD') })))
  })

  it('hides the difference choice when the items add up exactly', async () => {
    const { panel, addItem } = await openItems(['1', '0', '0', '0'])
    await addItem(['1', '0', '0', '0'])
    expect(panel().queryByRole('radiogroup', { name: t('split.overflowRule') })).not.toBeInTheDocument()
  })

  it('deletes an item', async () => {
    const { user, panel, addItem, header } = await openItems(['1', '0', '0', '0'])
    await addItem(['6', '0', '0'])
    await addItem(['4', '0', '0'])
    await user.click(panel().getByRole('button', { name: t('split.removeItem', { name: t('split.itemPlaceholder', { n: 1 }) }) }))
    expect(header()).toHaveTextContent(tPlural('split.summaryItems', { count: 1 }))
  })

  it('saves the items, blank names and the chosen difference rule', async () => {
    const { user, panel, addItem, stores } = await openItems(['3', '8', '0', '0'])
    await addItem(['3', '4', '0', '0'])
    await user.click(within(panel().getByRole('radiogroup', { name: t('split.overflowRule') })).getByRole('radio', { name: t('split.overflowEven') }))
    await user.type(screen.getByLabelText(t('expense.description')), '居酒屋')
    await user.click(screen.getByRole('button', { name: t('expense.save') }))
    await waitFor(() => expect(currentRoute()).toBe('/trip/t1/expenses'))
    const [saved] = await stores.repo.listExpenses('t1')
    expect(saved?.split).toEqual({ mode: 'items', overflowRule: 'even', items: [expect.objectContaining({ name: '', amount: 3400, participants: ['a', 'b', 'c'] })] })
  })

  it('blocks saving without any item', async () => {
    const { user } = await openItems(['1', '0', '0'])
    await user.type(screen.getByLabelText(t('expense.description')), '空的')
    expect(screen.getByRole('button', { name: t('expense.save') })).toBeDisabled()
  })
})
