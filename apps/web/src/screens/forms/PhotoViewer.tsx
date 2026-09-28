import { Button, Icon, SafeArea } from '@billing/ui'
import { IconX } from '@tabler/icons-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n/useI18n'

/** 收據放大檢視（task#101）：蓋住整個畫面、照片完整顯示；✕ 或 Escape 關閉 */
export function PhotoViewer({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={label} className="app-photo-viewer">
      <SafeArea edges={['top', 'bottom', 'left', 'right']}>
        <div className="flex justify-end p-2">
          {/* 自動聚焦關閉鍵：開啟後鍵盤與螢幕閱讀器第一個碰到的就是出口 */}
          <Button variant="secondary" aria-label={t('photo.close')} onClick={onClose} autoFocus>
            <Icon glyph={IconX} />
          </Button>
        </div>
      </SafeArea>
      <img src={src} alt={label} />
    </div>,
    document.body,
  )
}
