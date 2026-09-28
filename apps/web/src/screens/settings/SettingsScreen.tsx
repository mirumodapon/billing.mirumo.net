import { AppBar } from '@billing/ui'
import { useNavigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { BackupSection } from './BackupSection'
import { CategoriesSection } from './CategoriesSection'
import { LanguageSection } from './LanguageSection'
import { PaymentMethodsSection } from './PaymentMethodsSection'
import { StorageSection } from './StorageSection'
import { ThemeSection } from './ThemeSection'
import { useRecordUsage } from './useRecordUsage'

/** 全域設定（規格 4.8）。備份、儲存用量、錯誤記錄與版本資訊在 Plan 10 加入 */
export function SettingsScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const usage = useRecordUsage()
  return (
    <div className="app-screen">
      <AppBar title={t('settings.title')} onBack={() => navigate('/')} backLabel={t('common.back')} />
      <div className="app-scroll flex flex-col gap-2">
        <LanguageSection />
        <ThemeSection />
        <CategoriesSection usage={usage} />
        <PaymentMethodsSection usage={usage} />
        <BackupSection />
        <StorageSection />
      </div>
    </div>
  )
}
