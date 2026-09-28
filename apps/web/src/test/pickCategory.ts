import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { t } from '../i18n'

/**
 * 在支出表單選類別。新支出不再帶入類別（每一筆自己選），要存成完成的紀錄就得先選一個。
 * 「明細」區塊收著的話先打開。
 */
export async function pickCategory(user: UserEvent, label: string = t('cat.food')): Promise<void> {
  const header = screen.getAllByRole('button', { name: new RegExp(`^${t('expense.details')}`) }).find((b) => b.hasAttribute('aria-expanded'))!
  if (header.getAttribute('aria-expanded') !== 'true') await user.click(header)
  await user.click(within(screen.getByRole('radiogroup', { name: t('expense.category') })).getByRole('radio', { name: label }))
}
