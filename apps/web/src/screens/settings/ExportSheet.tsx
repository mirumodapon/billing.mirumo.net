import { Button, Chip, SegmentedControl, Sheet } from '@billing/ui'
import { useEffect, useState } from 'react'
import type { Snapshot } from '../../data/types'
import { estimateExportBytes, runExport } from '../../domain/backup'
import { formatBytes } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'

type Format = 'json' | 'csv' | 'both'

export interface ExportSheetProps {
  open: boolean
  onClose: () => void
}

/**
 * 匯出備份（規格 4.8、13.2.1）：格式、是否含收據照片，下方即時顯示預估大小。
 * 真的交出檔案後關閉並告知；使用者在分享面板取消就留在這裡。
 */
export function ExportSheet({ open, onClose }: ExportSheetProps) {
  const { t } = useI18n()
  const stores = useStores()
  const settings = useSettings((s) => s.settings)
  const [format, setFormat] = useState<Format>('json')
  const [includePhotos, setIncludePhotos] = useState(false)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [busy, setBusy] = useState(false)

  // 每次打開重新讀一次：預估大小要反映現在的資料
  useEffect(() => {
    if (!open) return
    let alive = true
    void stores.repo.exportSnapshot().then((s) => alive && setSnapshot(s))
    return () => {
      alive = false
    }
  }, [open, stores.repo])

  const options = { json: format !== 'csv', csv: format !== 'json', includePhotos }
  const estimate = snapshot ? formatBytes(estimateExportBytes(snapshot, options)) : null

  const submit = async () => {
    setBusy(true)
    try {
      const result = await runExport(stores, settings, options)
      if (result === 'cancelled') return
      onClose()
      stores.ui.getState().show({ id: 'exported', message: t('backup.exported') })
    } catch {
      stores.ui.getState().show({ id: 'export-failed', message: t('backup.exportFailed') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('backup.export')}>
      <div className="app-form">
        <SegmentedControl<Format>
          ariaLabel={t('backup.format')}
          value={format}
          options={[
            { value: 'json', label: t('backup.formatJson') },
            { value: 'csv', label: t('backup.formatCsv') },
            { value: 'both', label: t('backup.formatBoth') },
          ]}
          onChange={setFormat}
        />
        <p className="app-field-label m-0">{format === 'csv' ? t('backup.csvHint') : t('backup.jsonHint')}</p>
        <div>
          <Chip label={t('backup.includePhotos')} selected={includePhotos} onSelect={() => setIncludePhotos((v) => !v)} />
        </div>
        <p className="app-field-label m-0" data-testid="export-estimate">
          {estimate ? t('backup.estimate', { size: estimate }) : ' '}
        </p>
        <Button busy={busy} onClick={() => void submit()}>
          {t('backup.exportNow')}
        </Button>
      </div>
    </Sheet>
  )
}
