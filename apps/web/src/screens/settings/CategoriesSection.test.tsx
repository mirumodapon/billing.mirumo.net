import { ACCENT_ORDER, pickAccent } from '@billing/ui'
import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSettings } from '../../data/defaults'
import { clearSession } from '../../data/session'
import { makeExpense, makeTrip } from '../../data/testing/fixtures'
import type { AppSettings } from '../../data/types'
import { t, tPlural } from '../../i18n'
import { makeStores, renderApp } from '../../test/renderApp'
import { confirmDelete } from '../../test/confirmDelete'

beforeEach(() => clearSession())

const onsen = { id: 'onsen', name: '溫泉', icon: 'IconBeach' as const, colorKey: 'accent2' as const, builtin: false }
const spare = { id: 'spare', name: '雜支', icon: 'IconCoin' as const, colorKey: 'accent12' as const, builtin: false }

async function setup(options: { usedCategory?: string; locale?: AppSettings['locale'] } = {}) {
  const stores = await makeStores()
  const settings = defaultSettings()
  await stores.repo.saveSettings({ ...settings, locale: options.locale ?? 'zh-TW', categories: [...settings.categories, onsen, spare] })
  await stores.repo.saveTrip(makeTrip({ id: 't1' }))
  if (options.usedCategory) await stores.repo.saveExpense(makeExpense({ tripId: 't1', categoryId: options.usedCategory }))
  const app = await renderApp('/settings', stores)
  const section = within(screen.getByRole('region', { name: t('settings.categories') }))
  return { ...app, section }
}

const savedCategories = async (stores: Awaited<ReturnType<typeof setup>>['stores']) => (await stores.repo.getSettings()).categories

describe('CategoriesSection', () => {
  it('names built-in categories in the current language and custom ones as typed', async () => {
    const { section } = await setup({ locale: 'en-US' })
    expect(section.getByRole('button', { name: /^Food/ })).toBeInTheDocument()
    expect(section.getByRole('button', { name: /^溫泉/ })).toBeInTheDocument()
  })

  it('adds a custom category with a name, icon and colour', async () => {
    const { user, section, stores } = await setup()
    await user.click(section.getByRole('button', { name: t('settings.addCategory') }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.addCategory') }))
    await user.type(sheet.getByLabelText(t('settings.categoryName')), '伴手禮')
    await user.click(sheet.getByRole('radio', { name: t('icon.Gift') }))
    await user.click(sheet.getByRole('radio', { name: t('settings.colorN', { n: 3 }) }))
    await user.click(sheet.getByRole('button', { name: t('settings.save') }))
    await waitFor(async () => expect((await savedCategories(stores)).at(-1)).toMatchObject({ name: '伴手禮', icon: 'IconGift', colorKey: 'accent7', builtin: false }))
    expect((await savedCategories(stores)).at(-1)!.id).not.toMatch(/^cat\./)
  })

  it('needs a name for a custom category', async () => {
    const { user, section, stores } = await setup()
    await user.click(section.getByRole('button', { name: t('settings.addCategory') }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.addCategory') }))
    await user.click(sheet.getByRole('button', { name: t('settings.save') }))
    expect(sheet.getByText(t('settings.nameRequired'))).toBeInTheDocument()
    expect(await savedCategories(stores)).toHaveLength(8)
  })

  // 新類別預選用得最少的顏色，而不是一律從第一格開始
  it('suggests the least-used colour for a new category', async () => {
    const { user, section } = await setup()
    await user.click(section.getByRole('button', { name: t('settings.addCategory') }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.addCategory') }))
    const used = [...defaultSettings().categories.map((c) => c.colorKey), onsen.colorKey, spare.colorKey]
    const expected = pickAccent(used)
    const colours = within(sheet.getByRole('radiogroup', { name: t('settings.categoryColor') }))
    expect(colours.getByRole('radio', { checked: true })).toHaveAccessibleName(t('settings.colorN', { n: ACCENT_ORDER.indexOf(expected) + 1 }))
  })

  // 內建名稱來自語言檔，改了切換語系就對不起來
  it('edits a built-in category’s icon and colour but not its name', async () => {
    const { user, section, stores } = await setup()
    await user.click(section.getByRole('button', { name: new RegExp(`^${t('cat.food')}`) }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.editCategory') }))
    expect(sheet.queryByLabelText(t('settings.categoryName'))).not.toBeInTheDocument()
    await user.click(sheet.getByRole('radio', { name: t('icon.Coffee') }))
    await user.click(sheet.getByRole('button', { name: t('settings.save') }))
    await waitFor(async () => expect((await savedCategories(stores))[0]).toEqual({ ...defaultSettings().categories[0], icon: 'IconCoffee' }))
  })

  it('removes an unused custom category', async () => {
    const { user, section, stores } = await setup()
    await user.click(await section.findByRole('button', { name: t('settings.removeItem', { name: '雜支' }) }))
    await confirmDelete(user, '雜支')
    await waitFor(async () => expect((await savedCategories(stores)).map((c) => c.id)).not.toContain('spare'))
  })

  // Plan 6 D6：刪了統計會出現沒有名字的類別
  it('keeps a custom category that expenses still use, and says how many', async () => {
    const { section } = await setup({ usedCategory: 'onsen' })
    expect(await section.findByText(tPlural('settings.usedBy', { count: 1 }))).toBeInTheDocument()
    await section.findByRole('button', { name: t('settings.removeItem', { name: '雜支' }) })
    expect(section.queryByRole('button', { name: t('settings.removeItem', { name: '溫泉' }) })).not.toBeInTheDocument()
  })

  it('never offers to remove a built-in category', async () => {
    const { section } = await setup()
    await section.findByRole('button', { name: t('settings.removeItem', { name: '雜支' }) })
    expect(section.queryByRole('button', { name: t('settings.removeItem', { name: t('cat.food') }) })).not.toBeInTheDocument()
  })

  it('names every colour and icon for assistive tech', async () => {
    const { user, section } = await setup()
    await user.click(section.getByRole('button', { name: t('settings.addCategory') }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.addCategory') }))
    const colours = within(sheet.getByRole('radiogroup', { name: t('settings.categoryColor') })).getAllByRole('radio')
    expect(colours.map((r) => r.getAttribute('aria-label'))).toEqual(Array.from({ length: 12 }, (_, i) => t('settings.colorN', { n: i + 1 })))
    const icons = within(sheet.getByRole('radiogroup', { name: t('settings.categoryIcon') })).getAllByRole('radio')
    for (const icon of icons) expect(icon).toHaveAccessibleName(/\S/)
  })
})

describe('CategoriesSection layout (task#113)', () => {
  // 整列寬的框：刪除鍵在框內右側，與付款方式一樣，不再另留一欄讓框變窄
  it('keeps the delete button inside the full-width row', async () => {
    const { section } = await setup()
    const remove = await section.findByRole('button', { name: t('settings.removeItem', { name: '雜支' }) })
    const row = remove.closest('li')!
    expect(row).toHaveClass('app-row')
    expect(within(row).getByRole('button', { name: /^雜支/ })).toHaveClass('app-row__main')
  })
})

describe('icon names (task#87)', () => {
  // 中文使用者的螢幕閱讀器念中文名稱，不是 Gift、Beach 這種識別字
  it('names the icons in the current language', async () => {
    const { user, section } = await setup({ locale: 'zh-TW' })
    await user.click(section.getByRole('button', { name: t('settings.addCategory') }))
    const sheet = within(screen.getByRole('dialog', { name: t('settings.addCategory') }))
    expect(sheet.getByRole('radio', { name: '禮物' })).toBeInTheDocument()
    expect(sheet.queryByRole('radio', { name: 'Gift' })).not.toBeInTheDocument()
  })
})
