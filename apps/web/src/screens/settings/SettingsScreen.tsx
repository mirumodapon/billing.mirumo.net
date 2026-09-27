import { AppBar } from '@billing/ui'
import { useNavigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { LanguageSection } from './LanguageSection'
import { ThemeSection } from './ThemeSection'

/** 全域設定（規格 4.8）。匯出、匯入、儲存用量、錯誤記錄隨第 9 階段加入（Plan 6 D7） */
export function SettingsScreen() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div className="app-screen">
      <AppBar title={t('settings.title')} onBack={() => navigate('/')} backLabel={t('common.back')} />
      <div className="app-scroll flex flex-col gap-2">
        <LanguageSection />
        <ThemeSection />
      </div>
    </div>
  )
}
