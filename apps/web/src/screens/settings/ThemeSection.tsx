import { SegmentedControl, SheetPicker, THEMES, type ThemeFamily, type ThemeId } from '@billing/ui'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'

/** 家族名稱是專有名詞，不翻譯 */
const FAMILIES: { value: ThemeFamily; label: string }[] = [
  { value: 'catppuccin', label: 'Catppuccin' },
  { value: 'tokyo-night', label: 'Tokyo Night' },
]

/**
 * 主題（規格 5.8、13.4）：跟隨系統明暗，或指定八個主題之一。選了立刻套用，
 * 本身就是預覽。沒有色帶預覽：主題選擇器是 :root[data-theme]，單一列套不上。
 */
export function ThemeSection() {
  const { t } = useI18n()
  const { settings } = useStores()
  const theme = useSettings((s) => s.settings.theme)
  const family = useSettings((s) => s.settings.themeFamily)
  const [picking, setPicking] = useState(false)
  const label = theme === 'system' ? t('settings.themeSystem') : (THEMES.find((x) => x.id === theme)?.label ?? theme)

  const choose = (value: string) => {
    setPicking(false)
    const id = value as ThemeId | 'system'
    // 指定主題時順便記下它的家族：之後改回「跟隨系統」會停在同一個家族
    const chosenFamily = THEMES.find((x) => x.id === id)?.family
    void settings.getState().update((s) => ({ ...s, theme: id, themeFamily: chosenFamily ?? s.themeFamily }))
  }

  return (
    <section className="app-form">
      <h2 className="app-card__title">{t('settings.theme')}</h2>
      <button type="button" className="app-row" aria-haspopup="dialog" onClick={() => setPicking(true)}>
        <span>{t('settings.theme')}</span>
        <span className="app-row__value">{label}</span>
      </button>
      {theme === 'system' ? (
        <div>
          <p className="app-field-label">{t('settings.themeFamily')}</p>
          <SegmentedControl<ThemeFamily>
            ariaLabel={t('settings.themeFamily')}
            value={family}
            options={FAMILIES}
            onChange={(f) => void settings.getState().update((s) => ({ ...s, themeFamily: f }))}
          />
        </div>
      ) : null}
      <SheetPicker
        open={picking}
        title={t('settings.theme')}
        options={[{ value: 'system', label: t('settings.themeSystem') }, ...THEMES.map((x) => ({ value: x.id, label: x.label }))]}
        value={theme}
        onSelect={choose}
        onClose={() => setPicking(false)}
      />
    </section>
  )
}
