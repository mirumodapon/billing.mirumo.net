import { Button, Icon } from '@billing/ui'
import { IconDeviceMobileDown, IconShare2, IconSquarePlus } from '@tabler/icons-react'
import { useState } from 'react'
import { dismissInstall, installDismissed, isIos, isStandalone, useInstallPrompt } from '../domain/install'
import { useI18n } from '../i18n/useI18n'

/**
 * 安裝到主畫面的引導卡（規格 7.4、Plan 10 P6）。至少有一趟旅程、不是從主畫面開的、
 * 也沒按過「不再顯示」時才出現。Android 直接叫出系統安裝提示；iOS 用圖示教學。
 */
export function InstallCard({ hasTrips }: { hasTrips: boolean }) {
  const { t } = useI18n()
  const prompt = useInstallPrompt()
  const [dismissed, setDismissed] = useState(installDismissed)
  const ios = isIos()
  if (!hasTrips || dismissed || isStandalone() || (!prompt && !ios)) return null

  return (
    <section className="app-card" aria-labelledby="install-title" data-testid="install-card">
      <h2 id="install-title" className="app-card__title flex items-center gap-2">
        <Icon glyph={IconDeviceMobileDown} />
        {t('install.title')}
      </h2>
      <p className="app-field-label m-0">{t('install.why')}</p>
      {prompt ? (
        <Button onClick={() => void prompt()}>{t('install.now')}</Button>
      ) : (
        <ol className="app-field-label m-0 flex flex-col gap-1 pl-4">
          <li>
            {t('install.iosShare')} <Icon glyph={IconShare2} size="sm" ariaLabel={t('install.shareIcon')} />
          </li>
          <li>
            {t('install.iosAdd')} <Icon glyph={IconSquarePlus} size="sm" ariaLabel={t('install.addIcon')} />
          </li>
        </ol>
      )}
      <Button
        variant="ghost"
        onClick={() => {
          dismissInstall()
          setDismissed(true)
        }}
      >
        {t('install.dismiss')}
      </Button>
    </section>
  )
}
