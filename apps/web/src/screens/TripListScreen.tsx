import { AppBar } from '@billing/ui'
import { useI18n } from '../i18n/useI18n'

export function TripListScreen() {
  const { t } = useI18n()
  return <AppBar title={t('tripList.title')} />
}
