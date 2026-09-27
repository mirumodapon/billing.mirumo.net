import { Button, Icon, SafeArea } from '@billing/ui'
import { IconX } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useI18n } from '../../i18n/useI18n'

/**
 * 唯讀檢視頁的外框（task#101）：✕、標題、編輯。從列表點開先到這裡，
 * 誤觸不會改到任何東西；要改再按「編輯」。
 */
export function ViewShell({ title, editTo, fallback, children }: { title: string; editTo: string; fallback: string; children: ReactNode }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()
  const close = () => (location.key !== 'default' ? navigate(-1) : navigate(fallback, { replace: true }))
  return (
    <div className="app-screen">
      <SafeArea edges={['top', 'left', 'right']}>
        <header className="app-form-header">
          <Button variant="ghost" aria-label={t('form.close')} onClick={close}>
            <Icon glyph={IconX} />
          </Button>
          <h1 className="app-form-header__title">{title}</h1>
          <Button variant="secondary" onClick={() => navigate(editTo)}>
            {t('view.edit')}
          </Button>
        </header>
      </SafeArea>
      <div className="app-scroll">
        <div className="app-form">{children}</div>
      </div>
    </div>
  )
}

/** 檢視頁的一列「標籤 … 值」 */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="app-fact">
      <span>{label}</span>
      <span className="text-end">{children}</span>
    </div>
  )
}
