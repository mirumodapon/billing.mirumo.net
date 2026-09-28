import { useI18n } from '../../i18n/useI18n'

/**
 * 「草稿」標記，用警示色（task#110）：草稿不算進任何總額，要一眼看得出來，
 * 不能跟一般的灰色標籤混在一起。
 */
export function DraftTag() {
  const { t } = useI18n()
  return <span className="app-draft-tag">{t('record.draft')}</span>
}
