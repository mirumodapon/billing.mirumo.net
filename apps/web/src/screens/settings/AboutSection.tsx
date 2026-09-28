import { useI18n } from '../../i18n/useI18n'

/** 版本資訊（規格 4.8）：回報問題時要說得出是哪一版 */
export function AboutSection() {
  const { t } = useI18n()
  return (
    <section className="app-form" aria-labelledby="settings-about">
      <h2 id="settings-about" className="app-card__title">
        {t('about.title')}
      </h2>
      <p className="app-field-label m-0" data-testid="app-version">
        {t('about.version', { version: __APP_VERSION__, hash: __APP_COMMIT__ })}
      </p>
    </section>
  )
}
