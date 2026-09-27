import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { formatDate, formatWeekday } from '../../i18n/format'
import { StoresProvider } from '../../stores/StoresProvider'
import { makeStores } from '../../test/renderApp'
import { pickDate } from '../../test/pickDate'
import { DateField } from './DateField'

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial)
  return <DateField label="日期" value={value} onChange={setValue} />
}

async function mount(initial: string) {
  const stores = await makeStores()
  // 與 app 一樣先載入設定：DateField 讀 store 的語系，pickDate 讀 i18n 的語系，兩者要一致
  await stores.settings.getState().load()
  render(
    <StoresProvider stores={stores}>
      <Harness initial={initial} />
    </StoresProvider>,
  )
  return userEvent.setup()
}

describe('DateField (task#97)', () => {
  it('shows the date and its weekday on one row', async () => {
    await mount('2026-03-15')
    expect(screen.getByRole('button', { name: /^日期/ })).toHaveTextContent(`${formatDate('2026-03-15')} (${formatWeekday('2026-03-15')})`)
  })

  // 不再先列一排日期條：點開直接是月曆
  it('opens straight to a month calendar, with no strip of days first', async () => {
    const user = await mount('2026-03-15')
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^日期/ }))
    expect(screen.getByRole('dialog', { name: '日期' })).toBeInTheDocument()
  })

  it('takes the chosen day and closes', async () => {
    const user = await mount('2026-03-15')
    await pickDate(user, '日期', '2026-03-28')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^日期/ })).toHaveTextContent(formatDate('2026-03-28'))
  })
})
