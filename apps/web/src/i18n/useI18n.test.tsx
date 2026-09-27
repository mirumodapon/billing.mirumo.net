import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StoresProvider } from '../stores/StoresProvider'
import { makeStores } from '../test/renderApp'
import { useI18n } from './useI18n'

function Probe() {
  const { t } = useI18n()
  return <p>{t('pay.cash')}</p>
}

describe('useI18n', () => {
  // 規格 6.5：切換不需重新載入。這條證明訂閱語系的元件會跟著重繪、而且拿到的是新語系
  it('re-renders in the new language when the setting changes', async () => {
    const stores = await makeStores()
    await stores.settings.getState().update((s) => ({ ...s, locale: 'zh-TW' }))
    render(
      <StoresProvider stores={stores}>
        <Probe />
      </StoresProvider>,
    )
    expect(screen.getByText('現金')).toBeInTheDocument()
    await act(() => stores.settings.getState().update((s) => ({ ...s, locale: 'en-US' })))
    expect(screen.getByText('Cash')).toBeInTheDocument()
  })

  it('needs the stores to be provided', () => {
    // React 會把拋出的錯誤再印一次到 console；這裡預期會拋，不必洗版
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Probe />)).toThrow('StoresProvider is missing')
  })
})
