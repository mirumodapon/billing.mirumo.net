import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { getLocale } from '../i18n'

/** 點開名為 label 的日期欄，在月曆裡選 iso 那一天（DateField，task#97） */
export async function pickDate(user: UserEvent, label: string, iso: string, scope: { getByRole: typeof screen.getByRole } = screen) {
  await user.click(scope.getByRole('button', { name: new RegExp(`^${label}`) }))
  const calendar = within(screen.getByRole('dialog', { name: label }))
  const full = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
  await user.click(calendar.getByRole('button', { name: full }))
}

/** 點開名為 label 的旅行時間欄，在月曆裡依序點 first 與 second 兩天（DateRangeField，task#126） */
export async function pickDateRange(
  user: UserEvent,
  label: string,
  first: string,
  second: string,
  scope: { getByRole: typeof screen.getByRole } = screen,
) {
  await user.click(scope.getByRole('button', { name: new RegExp(`^${label}`) }))
  const calendar = within(screen.getByRole('dialog', { name: label }))
  const full = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'full', timeZone: 'UTC' })
  for (const iso of [first, second]) await user.click(calendar.getByRole('button', { name: full.format(new Date(`${iso}T00:00:00Z`)) }))
}
