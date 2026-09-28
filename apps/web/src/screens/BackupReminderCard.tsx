import { Button } from '@billing/ui'
import { useState } from 'react'
import { lastExportAt } from '../domain/backup'
import { tripNeedingBackup } from '../domain/backupReminder'
import { todayIso } from '../domain/dates'
import { useI18n } from '../i18n/useI18n'
import { useTrips } from '../stores/StoresProvider'
import { ExportSheet } from './settings/ExportSheet'

const SNOOZE_KEY = 'bi-backup-snoozed'

function snoozed(): boolean {
  try {
    return sessionStorage.getItem(SNOOZE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 旅程結束後的備份提醒（規格 7.4、Plan 10 P7）。「稍後」只在這次開 app 期間隱藏；
 * 匯出成功後上次匯出的時間晚於結束日，卡片就自然消失。
 */
export function BackupReminderCard() {
  const { t } = useI18n()
  const trips = useTrips((s) => s.trips)
  const [exporting, setExporting] = useState(false)
  const [hidden, setHidden] = useState(snoozed)
  // 匯出 sheet 關上時重新讀：剛匯出的話卡片要跟著消失
  const [lastExport, setLastExport] = useState(lastExportAt)
  const trip = tripNeedingBackup(trips, todayIso(), lastExport)
  if (!trip || hidden) return null

  return (
    <section className="app-card" aria-labelledby="backup-reminder-title" data-testid="backup-reminder">
      <h2 id="backup-reminder-title" className="app-card__title">
        {t('reminder.title', { name: trip.name })}
      </h2>
      <p className="app-field-label m-0">{t('reminder.why')}</p>
      <Button onClick={() => setExporting(true)}>{t('backup.export')}</Button>
      <Button
        variant="ghost"
        onClick={() => {
          try {
            sessionStorage.setItem(SNOOZE_KEY, '1')
          } catch {
            // 記不住就只在這一頁隱藏
          }
          setHidden(true)
        }}
      >
        {t('reminder.later')}
      </Button>
      <ExportSheet
        open={exporting}
        onClose={() => {
          setExporting(false)
          setLastExport(lastExportAt())
        }}
      />
    </section>
  )
}
