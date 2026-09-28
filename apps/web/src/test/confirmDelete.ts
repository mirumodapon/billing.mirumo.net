import { screen, within } from '@testing-library/react'
import type { UserEvent } from '@testing-library/user-event'
import { t } from '../i18n'

/** 刪除一律先確認：在確認框裡按「刪除」。name 是框上寫的那一筆的名字 */
export async function confirmDelete(user: UserEvent, name: string): Promise<void> {
  const dialog = await screen.findByRole('dialog', { name: t('confirm.deleteTitle', { name }) })
  await user.click(within(dialog).getByRole('button', { name: t('common.delete') }))
}
