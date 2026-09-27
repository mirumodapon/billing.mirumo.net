import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { t } from '../../i18n'
import { StoresProvider } from '../../stores/StoresProvider'
import { makeStores } from '../../test/renderApp'
import { AmountField } from './AmountField'

async function mount(value: number | undefined, decimals = 0) {
  const onChange = vi.fn()
  const stores = await makeStores()
  render(
    <StoresProvider stores={stores}>
      <AmountField label="總預算" value={value} decimals={decimals} format={(v) => `NT$${v}`} onChange={onChange} />
    </StoresProvider>,
  )
  return { onChange, user: userEvent.setup() }
}

const key = (name: string) => screen.getByRole('button', { name })

describe('AmountField', () => {
  it('says the amount is not set rather than showing zero', async () => {
    await mount(undefined)
    expect(screen.getByRole('button', { name: new RegExp(`總預算.*${t('budget.notSet')}`) })).toBeInTheDocument()
  })

  it('works out a sum on the keypad and reports the result on done', async () => {
    const { onChange, user } = await mount(undefined)
    await user.click(screen.getByRole('button', { name: /總預算/ }))
    for (const k of ['3', '000', '+', '2', '000']) await user.click(key(k))
    await user.click(key(t('keypad.done')))
    expect(onChange).toHaveBeenCalledWith(5000)
    expect(screen.queryByRole('button', { name: t('keypad.done') })).not.toBeInTheDocument()
  })

  it('starts from the current value', async () => {
    const { onChange, user } = await mount(1200)
    await user.click(screen.getByRole('button', { name: /總預算/ }))
    await user.click(key('0'))
    await user.click(key(t('keypad.done')))
    expect(onChange).toHaveBeenCalledWith(12000)
  })

  // 規格 2.2：未設就是 undefined，不是 0
  it('reports no amount when cleared', async () => {
    const { onChange, user } = await mount(1200)
    await user.click(screen.getByRole('button', { name: /總預算/ }))
    await user.click(key(t('keypad.clear')))
    await user.click(key(t('keypad.done')))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('passes the decimals on to the keypad', async () => {
    const { user } = await mount(undefined, 0)
    await user.click(screen.getByRole('button', { name: /總預算/ }))
    expect(key('.')).toBeDisabled()
  })
})
