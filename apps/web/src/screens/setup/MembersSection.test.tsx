import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import { t } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'
import { confirmDelete } from '../../test/confirmDelete'

beforeEach(() => clearSession())

const members = [
  { id: 'a', name: '阿明', colorKey: 'accent4' as const },
  { id: 'b', name: '小美', colorKey: 'accent10' as const },
]

async function setup(options: { expensePaidBy?: string } = {}) {
  const stores = await makeStores()
  await stores.repo.saveTrip(makeTrip({ id: 't1', members, selfMemberId: 'a' }))
  if (options.expensePaidBy) {
    await stores.repo.saveExpense(makeExpense({ tripId: 't1', paidBy: options.expensePaidBy, split: { mode: 'even', participants: ['a', 'b'] } }))
  }
  const app = await renderApp('/trip/t1/setup', stores)
  await app.user.click(screen.getByRole('button', { name: new RegExp(`^${t('members.title')}`) }))
  return { ...app, panel: within(screen.getByTestId('section-members-panel')) }
}

const saved = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getTrip('t1'))!

describe('MembersSection', () => {
  it('adds a member in the next colour of the assignment order', async () => {
    const { user, panel, stores } = await setup()
    await user.type(panel.getByLabelText(t('members.newName')), '大熊')
    await user.click(panel.getByRole('button', { name: t('members.add') }))
    await waitFor(async () => expect((await saved(stores)).members).toHaveLength(3))
    // 已用 accent4、accent10 → ACCENT_ORDER 的下一格是 accent7
    expect((await saved(stores)).members[2]).toMatchObject({ name: '大熊', colorKey: 'accent7' })
    expect(panel.getByLabelText(t('members.newName'))).toHaveValue('')
  })

  it('does not add a member without a name', async () => {
    const { user, panel, stores } = await setup()
    await user.type(panel.getByLabelText(t('members.newName')), '   ')
    await user.click(panel.getByRole('button', { name: t('members.add') }))
    expect((await saved(stores)).members).toHaveLength(2)
  })

  // 規格 5.8：顏色永遠不是唯一的辨識方式
  it('shows every member’s name next to their colour', async () => {
    const { panel } = await setup()
    for (const m of members) {
      expect(panel.getByRole('img', { name: m.name })).toBeInTheDocument()
      expect(panel.getByLabelText(t('members.name', { name: m.name }))).toHaveValue(m.name)
    }
  })

  it('renames a member when the field loses focus, but never to a blank name', async () => {
    const { user, panel, stores } = await setup()
    const field = panel.getByLabelText(t('members.name', { name: '小美' }))
    await user.clear(field)
    await user.tab()
    expect(field).toHaveValue('小美')
    await user.clear(field)
    await user.type(field, '美美')
    await user.tab()
    await waitFor(async () => expect((await saved(stores)).members[1]?.name).toBe('美美'))
  })

  it('chooses who "I" am', async () => {
    const { user, panel, stores } = await setup()
    const group = panel.getByRole('radiogroup', { name: t('members.self') })
    await user.click(within(group).getByRole('radio', { name: '小美' }))
    await waitFor(async () => expect((await saved(stores)).selfMemberId).toBe('b'))
  })

  it('removes a member who has no records', async () => {
    const { user, panel, stores } = await setup()
    await user.click(panel.getByRole('button', { name: t('members.remove', { name: '小美' }) }))
    await confirmDelete(user, '小美')
    await waitFor(async () => expect((await saved(stores)).members.map((m) => m.id)).toEqual(['a']))
  })

  // task#61：資料層擋下，畫面說出是誰、為什麼，而不是通用的「儲存失敗」
  it('explains why a member who still has records cannot be removed', async () => {
    const { user, panel, stores } = await setup({ expensePaidBy: 'b' })
    await user.click(panel.getByRole('button', { name: t('members.remove', { name: '小美' }) }))
    await confirmDelete(user, '小美')
    const alert = await panel.findByRole('alert')
    expect(alert).toHaveTextContent(t('members.inUse', { names: '小美' }))
    expect(panel.getByRole('img', { name: '小美' })).toBeInTheDocument()
    expect((await saved(stores)).members).toHaveLength(2)
    expect(stores.ui.getState().queue).toEqual([])
  })

  it('does not offer to remove yourself', async () => {
    const { panel } = await setup()
    expect(panel.queryByRole('button', { name: t('members.remove', { name: '阿明' }) })).not.toBeInTheDocument()
    expect(panel.getByText(t('members.selfBadge'))).toBeInTheDocument()
  })
})

describe('MembersSection layout (task#103, #104)', () => {
  // 與付款方式同一個版面：名稱框整列寬，「我」或刪除鍵在框內右側
  it('keeps "me" and the delete buttons inside the name boxes', async () => {
    const { panel } = await setup()
    const inBox = (el: HTMLElement) => el.closest('.bi-field__control')
    expect(inBox(panel.getByText(t('members.selfBadge')))).not.toBeNull()
    expect(inBox(panel.getByRole('button', { name: t('members.add') }))).not.toBeNull()
    expect(panel.getByText(t('members.name', { name: '阿明' }))).toHaveClass('bi-visually-hidden')
  })
})
