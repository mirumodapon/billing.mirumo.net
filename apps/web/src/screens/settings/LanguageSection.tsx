import { SegmentedControl } from '@billing/ui'
import type { AppSettings } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'

type LocalePref = AppSettings['locale']

/**
 * 跟隨系統 / 繁體中文 / English（規格 6.5）。切換不需重新載入。
 * 兩個語言的名稱不進 i18n：永遠用該語言自己的寫法，切到看不懂的語言時才找得回來。
 */
export function LanguageSection() {
  const { t } = useI18n()
  const { settings } = useStores()
  const value = useSettings((s) => s.settings.locale)
  return (
    <section className="app-form">
      <h2 className="app-card__title">{t('settings.language')}</h2>
      <SegmentedControl<LocalePref>
        ariaLabel={t('settings.language')}
        value={value}
        options={[
          { value: 'system', label: t('settings.languageSystem') },
          { value: 'zh-TW', label: '繁體中文' },
          { value: 'en-US', label: 'English' },
        ]}
        onChange={(locale) => void settings.getState().update((s) => ({ ...s, locale }))}
      />
    </section>
  )
}
