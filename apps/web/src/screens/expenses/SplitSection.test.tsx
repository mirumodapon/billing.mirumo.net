import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeTrip } from '../../data/testing/fixtures'
import { formatMoney } from '../../i18n/format'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'
import { pickCategory } from '../../test/pickCategory'

beforeEach(() => clearSession())

async function openNew() {
  const stores = await makeStores()
  await stores.repo.saveSettings({ ...defaultSettings(), locale: 'zh-TW', lastUsed: { currency: 'TWD' } })
  await stores.repo.saveTrip(makeTrip({ id: 't1', baseCurrency: 'TWD' }))
  const app = await renderApp('/trip/t1/expense/new', stores)
  const header = () => screen.getByRole('button', { name: new RegExp(`^${t('split.title')}`) })
  const key = (name: string) => screen.getByRole('button', { name })
  async function amount(digits: string[]) {
    await app.user.click(screen.getByLabelText(t('expense.amount')))
    for (const d of digits) await app.user.click(key(d))
    await app.user.click(key(t('keypad.done')))
  }
  async function describe(text: string) {
    await app.user.type(screen.getByLabelText(t('expense.description')), text)
  }
  return { ...app, header, key, amount, describe, panel: () => within(screen.getByTestId('section-split-panel')) }
}

const plain = (s: string) => s.replace(/\s+/g, ' ')

describe('SplitSection: even', () => {
  // 1000 ÷ 3：有一個人多付 1 元，摘要顯示多的那個
  it('summarises the share each person pays, rounding up when it does not divide', async () => {
    const { user, header, panel, amount } = await openNew()
    await amount(['1', '0', '0', '0'])
    // 預設只有付款人（task#121）：先全選三個人
    await user.click(header())
    await user.click(within(panel().getByRole('group', { name: t('split.quick') })).getByRole('button', { name: t('split.everyone') }))
    expect(header()).toHaveTextContent(plain(t('split.summaryEven', { count: 3, amount: formatMoney(334, 'TWD') })))
  })

  // task#105：最後一個人也能取消。沒人分攤時表單照 task#96 存成草稿
  it('lets everyone drop out, which makes the form save a draft', async () => {
    const { user, header, panel, amount } = await openNew()
    await amount(['9', '0', '0'])
    await user.click(header())
    const group = within(panel().getByRole('group', { name: t('split.participants') }))
    // 預設只有付款人阿明（task#121）：取消他就沒人分攤了
    await user.click(group.getByRole('button', { name: '阿明' }))
    expect(group.getByRole('button', { name: '阿明' })).toHaveAttribute('aria-pressed', 'false')
    expect(header()).toHaveTextContent(t('split.summaryEvenNoAmount', { count: 0 }))
    expect(screen.getByRole('button', { name: t('form.saveDraft') })).toBeInTheDocument()
  })

  it('picks only the payer, everyone, or no one with one tap (task#105)', async () => {
    const { user, header, panel, amount } = await openNew()
    await amount(['9', '0', '0'])
    // 付款人不是我：「僅付款人」要跟著付款人走，不是選自己
    await user.click(screen.getByRole('button', { name: new RegExp(`^${t('expense.details')}`) }))
    await user.click(within(screen.getByRole('radiogroup', { name: t('expense.paidBy') })).getByRole('radio', { name: '小美' }))
    await user.click(header())
    const group = within(panel().getByRole('group', { name: t('split.participants') }))
    const pressed = () => ['阿明', '小美', '大熊'].filter((name) => group.getByRole('button', { name }).getAttribute('aria-pressed') === 'true')
    const quick = within(panel().getByRole('group', { name: t('split.quick') }))
    await user.click(quick.getByRole('button', { name: t('split.onlyPayer') }))
    expect(pressed()).toEqual(['小美'])
    await user.click(quick.getByRole('button', { name: t('split.none') }))
    expect(pressed()).toEqual([])
    await user.click(quick.getByRole('button', { name: t('split.everyone') }))
    expect(pressed()).toEqual(['阿明', '小美', '大熊'])
  })
})

describe('SplitSection: exact', () => {
  // 規格 4.4：未對齊時儲存鍵停用並提示差額
  it('saves only as a draft until the exact amounts add up to the total', async () => {
    const { user, header, panel, amount, describe, key } = await openNew()
    await amount(['3', '0', '0', '0'])
    await describe('晚餐')
    await pickCategory(user)
    await user.click(header())
    await user.click(panel().getByRole('radio', { name: t('split.exact') }))
    await user.click(panel().getByRole('button', { name: /^阿明/ }))
    for (const d of ['2', '0', '0', '0']) await user.click(key(d))
    await user.click(key(t('keypad.done')))
    expect(panel().getByRole('status')).toHaveTextContent(plain(t('split.remaining', { amount: formatMoney(1000, 'TWD') })))
    expect(screen.getByRole('button', { name: t('form.saveDraft') })).toBeEnabled()
    await user.click(panel().getByRole('button', { name: /^小美/ }))
    for (const d of ['1', '0', '0', '0']) await user.click(key(d))
    await user.click(key(t('keypad.done')))
    expect(screen.getByRole('button', { name: t('form.save') })).toBeEnabled()
  })

  it('says by how much the amounts go over the total', async () => {
    const { user, header, panel, amount, key } = await openNew()
    await amount(['1', '0', '0'])
    await user.click(header())
    await user.click(panel().getByRole('radio', { name: t('split.exact') }))
    await user.click(panel().getByRole('button', { name: /^阿明/ }))
    for (const d of ['1', '5', '0']) await user.click(key(d))
    await user.click(key(t('keypad.done')))
    expect(panel().getByRole('status')).toHaveTextContent(plain(t('split.over', { amount: formatMoney(50, 'TWD') })))
  })
})

describe('SplitSection: switching modes', () => {
  it('keeps what each mode had when switching back and forth', async () => {
    const { user, header, panel, amount } = await openNew()
    await amount(['9', '0', '0'])
    await user.click(header())
    await user.click(within(panel().getByRole('group', { name: t('split.participants') })).getByRole('button', { name: '大熊' }))
    await user.click(panel().getByRole('radio', { name: t('split.exact') }))
    await user.click(panel().getByRole('radio', { name: t('expense.splitEven') }))
    // 預設只有付款人（task#121），大熊是剛加進來的：切到指定再切回來，他還在
    expect(within(panel().getByRole('group', { name: t('split.participants') })).getByRole('button', { name: '大熊' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})
