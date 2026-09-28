import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorLog } from '../data/errorLog'
import { clearSession } from '../data/session'
import { makeTrip } from '../data/testing/fixtures'
import { lastExportAt } from '../domain/backup'
import { t } from '../i18n'
import { StoresProvider } from '../stores/StoresProvider'
import { makeStores, renderApp } from '../test/renderApp'
import { RouteErrorBoundary } from './RouteErrorBoundary'

function Bomb(): never {
  throw new Error('kaboom')
}

beforeEach(() => {
  clearSession()
  localStorage.clear()
  errorLog.clear()
  // React 會把接住的錯誤再印一次；測試輸出不需要那些
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('RouteErrorBoundary (spec 7.7)', () => {
  it('shows its own error screen and records the error', async () => {
    const stores = await makeStores()
    render(
      <StoresProvider stores={stores}>
        <RouteErrorBoundary>
          <Bomb />
        </RouteErrorBoundary>
      </StoresProvider>,
    )
    const alert = screen.getByRole('alert')
    expect(within(alert).getByRole('heading', { name: t('crash.title') })).toBeInTheDocument()
    expect(errorLog.list().at(-1)?.message).toBe('Error: kaboom')
  })

  // 出事時最怕資料沒了：錯誤畫面直接給匯出
  it('offers to export the data from the error screen', async () => {
    const stores = await makeStores()
    render(
      <StoresProvider stores={stores}>
        <RouteErrorBoundary>
          <Bomb />
        </RouteErrorBoundary>
      </StoresProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: t('crash.export') }))
    expect(await screen.findByText(t('backup.exported'))).toBeInTheDocument()
    expect(lastExportAt()).toBeDefined()
  })
})

describe('ErrorLogSection (spec 7.7)', () => {
  it('lists recorded errors newest first, copies them and clears after confirming', async () => {
    errorLog.record(new Error('first'))
    errorLog.record(new Error('second'))
    const { user } = await renderApp('/settings')
    const section = within(screen.getByRole('region', { name: t('errors.title') }))
    const items = within(section.getByTestId('error-entries')).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('second')
    expect(items[1]).toHaveTextContent('first')
    await user.click(section.getByRole('button', { name: t('errors.copy') }))
    expect(await navigator.clipboard.readText()).toContain('Error: first')
    await user.click(section.getByRole('button', { name: t('errors.clear') }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: t('common.delete') }))
    expect(section.getByText(t('errors.none'))).toBeInTheDocument()
    expect(errorLog.list()).toEqual([])
  })
})

describe('routes are wrapped', () => {
  // 真的頁面在畫的時候出錯：看到的是錯誤畫面，不是整片空白
  it('catches an error thrown while a real screen renders', async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'formatRange').mockImplementation(() => {
      throw new Error('bad date')
    })
    const stores = await makeStores()
    await stores.repo.saveTrip(makeTrip({ id: 't1', name: '東京' }))
    await renderApp('/', stores)
    expect(await screen.findByRole('heading', { name: t('crash.title') })).toBeInTheDocument()
    expect(errorLog.list().at(-1)?.message).toBe('Error: bad date')
  })
})
