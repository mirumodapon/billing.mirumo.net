import { ProgressBar } from '@billing/ui'
import { useEffect, useState } from 'react'
import { storageStatus, type StorageStatus } from '../../data/storageHealth'
import { formatBytes } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useStores } from '../../stores/StoresProvider'

/**
 * 儲存空間（規格 4.8、7.4）：用了多少、配額多少、照片幾張；用到 80% 就警示。
 * 瀏覽器不給估計值時只顯示照片張數。
 */
export function StorageSection() {
  const { t, tPlural } = useI18n()
  const { blobs } = useStores()
  const [status, setStatus] = useState<StorageStatus | null>(null)
  const [photos, setPhotos] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    void storageStatus().then((s) => alive && setStatus(s))
    void blobs
      .usage()
      .then((u) => alive && setPhotos(u.count))
      .catch(() => alive && setPhotos(null))
    return () => {
      alive = false
    }
  }, [blobs])

  return (
    <section className="app-form" aria-labelledby="settings-storage">
      <h2 id="settings-storage" className="app-card__title">
        {t('storage.title')}
      </h2>
      {status ? (
        <>
          <p className="app-field-label m-0" data-testid="storage-usage">
            {t('storage.used', { used: formatBytes(status.usage), quota: formatBytes(status.quota) })}
          </p>
          <ProgressBar
            ratio={status.ratio}
            level={status.nearlyFull ? 'warning' : 'normal'}
            ariaLabel={t('storage.usedPercent', { percent: Math.round(status.ratio * 100) })}
          />
          {status.nearlyFull ? (
            <p role="alert" className="app-error m-0">
              {t('storage.nearlyFull')}
            </p>
          ) : null}
        </>
      ) : null}
      {photos !== null ? <p className="app-field-label m-0">{tPlural('storage.photos', { count: photos })}</p> : null}
    </section>
  )
}
