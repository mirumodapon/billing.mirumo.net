import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession } from '../data/session'
import { t } from '../i18n'
import { currentRoute, renderApp } from '../test/renderApp'

beforeEach(() => clearSession())

async function openSheet() {
  const app = await renderApp('/')
  await app.user.click(screen.getByRole('button', { name: t('trip.new') }))
  const sheet = screen.getByRole('dialog', { name: t('trip.new') })
  return { ...app, sheet }
}

describe('NewTripSheet', () => {
  it('creates a trip with me as its only member and goes straight to its setup tab', async () => {
    const { user, sheet, stores } = await openSheet()
    await user.type(within(sheet).getByLabelText(t('newTrip.name')), '京都')
    await user.type(within(sheet).getByLabelText(t('newTrip.selfName')), '阿明')
    await user.click(within(sheet).getByRole('button', { name: t('newTrip.create') }))
    await waitFor(() => expect(currentRoute()).toMatch(/^\/trip\/.+\/setup$/))
    const [trip] = await stores.repo.listTrips()
    expect(trip).toMatchObject({ name: '京都', baseCurrency: 'TWD', members: [{ name: '阿明' }] })
    expect(currentRoute()).toBe(`/trip/${trip!.id}/setup`)
    // 剛建立的旅程還沒載入帳目：設定頁要照樣畫得出來，不能卡在無限重繪
    expect(await screen.findByRole('button', { name: new RegExp(`^${t('tripMethods.title')}`) })).toBeInTheDocument()
  })

  it('shows what is missing instead of creating', async () => {
    const { user, sheet, stores } = await openSheet()
    await user.click(within(sheet).getByRole('button', { name: t('newTrip.create') }))
    expect(within(sheet).getByText(t('newTrip.nameRequired'))).toBeInTheDocument()
    expect(within(sheet).getByText(t('newTrip.selfNameRequired'))).toBeInTheDocument()
    expect(await stores.repo.listTrips()).toEqual([])
    expect(currentRoute()).toBe('/')
  })

  // 規格 5.2：<select> → SheetPicker
  it('picks the home currency from a sheet, not a native select', async () => {
    const { user, sheet, stores } = await openSheet()
    expect(sheet.querySelector('select')).toBeNull()
    await user.click(within(sheet).getByRole('button', { name: new RegExp(t('newTrip.baseCurrency')) }))
    const picker = screen.getByRole('dialog', { name: t('newTrip.baseCurrency') })
    await user.click(within(picker).getByRole('radio', { name: /^JPY/ }))
    expect(within(sheet).getByRole('button', { name: new RegExp(t('newTrip.baseCurrency')) })).toHaveTextContent('JPY')
    await user.type(within(sheet).getByLabelText(t('newTrip.name')), '大阪')
    await user.type(within(sheet).getByLabelText(t('newTrip.selfName')), '阿明')
    await user.click(within(sheet).getByRole('button', { name: t('newTrip.create') }))
    expect((await stores.repo.listTrips())[0]?.baseCurrency).toBe('JPY')
  })

  it('starts blank again after being cancelled half-way', async () => {
    const { user, sheet } = await openSheet()
    await user.type(within(sheet).getByLabelText(t('newTrip.name')), '京都')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: t('trip.new') }))
    const again = screen.getByRole('dialog', { name: t('trip.new') })
    expect(within(again).getByLabelText(t('newTrip.name'))).toHaveValue('')
  })
})
