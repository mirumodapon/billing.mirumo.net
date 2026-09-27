import { AppBar } from '@billing/ui'
import { useNavigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'

export function SettingsScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return <AppBar title={t('settings.title')} onBack={() => navigate('/')} backLabel={t('common.back')} />
}
