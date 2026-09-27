import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearSession, readSession, writeSession } from '../data/session'
import { useSessionSync } from './useSessionSync'

function Probe({ enabled }: { enabled: boolean }) {
  const navigate = useNavigate()
  useSessionSync(enabled)
  return (
    <>
      <button onClick={() => navigate('/trip/t1/setup')}>trip</button>
      <button onClick={() => navigate('/settings')}>settings</button>
    </>
  )
}

const go = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

function mount(enabled: boolean) {
  const ui = (e: boolean) => (
    <MemoryRouter initialEntries={['/']}>
      <Probe enabled={e} />
    </MemoryRouter>
  )
  const result = render(ui(enabled))
  return { enable: () => result.rerender(ui(true)) }
}

beforeEach(() => clearSession())

describe('useSessionSync', () => {
  it('writes the current route and trip into the session as the route changes', () => {
    mount(true)
    go('trip')
    expect(readSession()).toMatchObject({ route: '/trip/t1/setup', tripId: 't1' })
    go('settings')
    expect(readSession()).toEqual({ route: '/settings' })
  })

  // 捲動位置、收折狀態也存在 session 裡，換頁只換路由，不能把它們洗掉
  it('keeps the rest of the session', () => {
    writeSession({ route: '/', scrollTop: { '/': 120 }, openAccordion: 'rates' })
    mount(true)
    go('settings')
    expect(readSession()).toEqual({ route: '/settings', scrollTop: { '/': 120 }, openAccordion: 'rates' })
  })

  // 冷啟動驗證完成前的暫時路由不能蓋掉 session：驗證要讀的正是它
  it('writes nothing until enabled', () => {
    writeSession({ route: '/trip/t1/setup', tripId: 't1' })
    const { enable } = mount(false)
    expect(readSession()?.route).toBe('/trip/t1/setup')
    enable()
    expect(readSession()?.route).toBe('/')
  })
})
