import { Button } from '@billing/ui'
import { useState } from 'react'
import { errorLog, type ErrorEntry } from '../../data/errorLog'
import { useI18n } from '../../i18n/useI18n'
import { useStores } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'

/** 複製出去給人看的格式：一筆一段，時間、訊息、堆疊 */
function asText(entries: readonly ErrorEntry[]): string {
  return entries.map((e) => [e.at, e.message, e.stack].filter(Boolean).join('\n')).join('\n\n')
}

/**
 * 錯誤記錄（規格 7.7）：本機最近 50 筆。沒有後端就沒有回報管道，
 * 回報問題時至少能複製 log 貼出來。
 */
export function ErrorLogSection() {
  const { t, locale } = useI18n()
  const { ui } = useStores()
  const [entries, setEntries] = useState(() => errorLog.list())
  const confirm = useConfirmDelete()
  const newestFirst = [...entries].reverse()
  const time = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso))

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText(entries))
      ui.getState().show({ id: 'errors-copied', message: t('errors.copied') })
    } catch {
      ui.getState().show({ id: 'errors-copy-failed', message: t('errors.copyFailed') })
    }
  }

  return (
    <section className="app-form" aria-labelledby="settings-errors">
      <h2 id="settings-errors" className="app-card__title">
        {t('errors.title')}
      </h2>
      {entries.length === 0 ? (
        <p className="app-field-label m-0">{t('errors.none')}</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="error-entries">
            {newestFirst.map((e, index) => (
              <li key={`${e.at}-${index}`} className="app-field-label">
                <span className="block">{time(e.at)}</span>
                <span className="block break-all" style={{ color: 'var(--bi-text)' }}>
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => void copy()}>
            {t('errors.copy')}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              confirm.ask(t('errors.title'), 'permanent', () => {
                errorLog.clear()
                setEntries([])
              })
            }
          >
            {t('errors.clear')}
          </Button>
        </>
      )}
      {confirm.dialog}
    </section>
  )
}
