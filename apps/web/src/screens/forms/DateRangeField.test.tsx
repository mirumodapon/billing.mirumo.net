import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { t } from '../../i18n'
import { formatDateRange } from '../../i18n/format'
import { StoresProvider } from '../../stores/StoresProvider'
import { makeStores } from '../../test/renderApp'
import { pickDateRange } from '../../test/pickDate'
import { DateRangeField } from './DateRangeField'

function Harness() {
  const [range, setRange] = useState({ start: '2026-03-14', end: '2026-03-16' })
  return <DateRangeField label="旅行時間" start={range.start} end={range.end} onChange={(start, end) => setRange({ start, end })} />
}

async function mount() {
  const stores = await makeStores()
  // 與 app 一樣先載入設定：欄位讀 store 的語系，pickDateRange 讀 i18n 的語系，兩者要一致
  await stores.settings.getState().load()
  render(
    <StoresProvider stores={stores}>
      <Harness />
    </StoresProvider>,
  )
  return userEvent.setup()
}

const row = () => screen.getByRole('button', { name: /^旅行時間/ })
const plain = (s: string) => s.replace(/\s+/g, ' ')

describe('DateRangeField (task#126)', () => {
  it('shows the whole trip on one row', async () => {
    await mount()
    expect(row()).toHaveTextContent(plain(formatDateRange('2026-03-14', '2026-03-16')))
  })

  it('sets the first and last day with two taps on one calendar, then closes', async () => {
    const user = await mount()
    await pickDateRange(user, '旅行時間', '2026-03-20', '2026-03-24')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(row()).toHaveTextContent(plain(formatDateRange('2026-03-20', '2026-03-24')))
  })

  // 先點晚的那天也行：早的那天就是出發
  it('puts the two taps in order whichever comes first', async () => {
    const user = await mount()
    await pickDateRange(user, '旅行時間', '2026-03-24', '2026-03-20')
    expect(row()).toHaveTextContent(plain(formatDateRange('2026-03-20', '2026-03-24')))
  })

  it('makes a one-day trip from two taps on the same day', async () => {
    const user = await mount()
    await pickDateRange(user, '旅行時間', '2026-03-18', '2026-03-18')
    expect(row()).toHaveTextContent(plain(formatDateRange('2026-03-18', '2026-03-18')))
  })

  it('says which tap comes next, and marks only the first day while waiting for the second', async () => {
    const user = await mount()
    await user.click(row())
    const dialog = within(screen.getByRole('dialog', { name: '旅行時間' }))
    expect(dialog.getByTestId('range-step')).toHaveTextContent(t('date.pickStart'))
    expect(dialog.getAllByRole('button', { pressed: true })).toHaveLength(2)
    await user.click(dialog.getAllByRole('button').find((b) => b.dataset.day === '2026-03-20')!)
    expect(dialog.getByTestId('range-step')).toHaveTextContent(t('date.pickEnd'))
    expect(dialog.getAllByRole('button', { pressed: true }).map((b) => b.dataset.day)).toEqual(['2026-03-20'])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  // 點了一下就關掉：下次打開重新點兩下，不會接著上次的第一下
  it('starts over when reopened after a single tap', async () => {
    const user = await mount()
    await user.click(row())
    await user.click(within(screen.getByRole('dialog')).getAllByRole('button').find((b) => b.dataset.day === '2026-03-20')!)
    await user.keyboard('{Escape}')
    await user.click(row())
    expect(within(screen.getByRole('dialog')).getByTestId('range-step')).toHaveTextContent(t('date.pickStart'))
    expect(row()).toHaveTextContent(plain(formatDateRange('2026-03-14', '2026-03-16')))
  })
})
