import { Button } from '@billing/ui'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { ExportSheet } from './ExportSheet'

/**
 * 備份（規格 4.8、7.4）。資料只存在這台裝置上：iOS 未安裝的網頁 7 天沒開會被清掉，
 * 定期匯出是最後一道保險，所以把這件事寫在這裡。
 */
export function BackupSection() {
  const { t } = useI18n()
  const [exporting, setExporting] = useState(false)
  return (
    <section className="app-form" aria-labelledby="settings-backup">
      <h2 id="settings-backup" className="app-card__title">
        {t('backup.title')}
      </h2>
      <p className="app-field-label m-0">{t('backup.hint')}</p>
      <Button variant="secondary" onClick={() => setExporting(true)}>
        {t('backup.export')}
      </Button>
      <ExportSheet open={exporting} onClose={() => setExporting(false)} />
    </section>
  )
}
