import { Button, Dialog, Sheet } from '@billing/ui'
import { useRef, useState } from 'react'
import { importArchive } from '../../data/archive'
import { previewImport, type ImportPreview } from '../../domain/backup'
import { useI18n } from '../../i18n/useI18n'
import { useStores } from '../../stores/StoresProvider'

/** 問題清單只列前幾條：驗證可能回報上百條，全部列出反而看不出重點 */
const SHOWN_PROBLEMS = 5

/**
 * 匯入備份（規格 4.8、Plan 10 P3/P4）：選檔 → 摘要 →「合併」或「取代」→ 寫入 → 重新載入。
 * 取代會清掉這台裝置上現有的帳，另外再確認一次。
 */
export function ImportFlow() {
  const { t, tPlural } = useI18n()
  const { repo, blobs, trips, settings, ui } = useStores()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: File; preview: ImportPreview } | null>(null)
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [busy, setBusy] = useState(false)

  const pick = async (file: File | undefined) => {
    if (!file) return
    setPending({ file, preview: await previewImport(file) })
  }

  const run = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    setBusy(true)
    try {
      const report = await importArchive(pending.file, repo, blobs, mode)
      await Promise.all([trips.getState().loadTrips(), settings.getState().load()])
      setPending(null)
      ui.getState().show({
        id: 'imported',
        message: report.photosMissing > 0 ? tPlural('backup.importedMissing', { count: report.photosMissing }) : t('backup.imported'),
      })
    } catch {
      ui.getState().show({ id: 'import-failed', message: t('backup.importFailed') })
    } finally {
      setBusy(false)
    }
  }

  const preview = pending?.preview
  return (
    <>
      <Button variant="secondary" onClick={() => input.current?.click()}>
        {t('backup.import')}
      </Button>
      {/* 規格 5.7：選檔是 OS 的介面；原生欄位藏在自製按鈕後面 */}
      <input
        ref={input}
        type="file"
        accept=".json,.zip,application/json,application/zip"
        hidden
        data-testid="import-input"
        onChange={(event) => {
          void pick(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <Sheet open={pending !== null} onClose={() => setPending(null)} title={t('backup.import')}>
        {preview?.ok ? (
          <div className="app-form">
            <p className="m-0" data-testid="import-summary">
              {t('backup.importSummary', { trips: preview.trips, expenses: preview.expenses, photos: preview.photos })}
            </p>
            <p className="app-field-label m-0">{t('backup.importModes')}</p>
            <Button busy={busy} onClick={() => void run('merge')}>
              {t('backup.merge')}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setConfirmReplace(true)}>
              {t('backup.replace')}
            </Button>
          </div>
        ) : preview ? (
          <div className="app-form">
            <p role="alert" className="app-error m-0">
              {t('backup.importInvalid')}
            </p>
            <ul className="app-field-label m-0 pl-4">
              {preview.problems.slice(0, SHOWN_PROBLEMS).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Sheet>
      <Dialog
        open={confirmReplace}
        title={t('backup.replaceTitle')}
        description={t('backup.replaceHint')}
        confirmLabel={t('backup.replace')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => {
          setConfirmReplace(false)
          void run('replace')
        }}
        onCancel={() => setConfirmReplace(false)}
      />
    </>
  )
}
