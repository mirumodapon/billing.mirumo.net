import { useI18n } from '../i18n/useI18n'

/** 支出、統計、結算三個 tab 在 Plan 7–9 才有內容；這裡先說明，而不是留一片空白 */
export function PlaceholderTab() {
  const { t } = useI18n()
  return (
    <p className="p-8 text-center text-sm" style={{ color: 'var(--bi-text-muted)' }}>
      {t('placeholder.comingSoon')}
    </p>
  )
}
