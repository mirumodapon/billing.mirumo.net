import { Button, Icon, TextField } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { PaymentMethod } from '../../data/types'
import { displayName } from '../../domain/names'
import type { RecordUsage } from '../../domain/usage'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'

/** 付款方式管理（規格 4.8）。沒有圖示與顏色（規格 2.1），規則同類別 */
export function PaymentMethodsSection({ usage }: { usage: RecordUsage | null }) {
  const { t } = useI18n()
  const { settings } = useStores()
  const methods = useSettings((s) => s.settings.paymentMethods)
  const [newName, setNewName] = useState('')
  const confirm = useConfirmDelete()

  const update = (change: (list: PaymentMethod[]) => PaymentMethod[]) =>
    void settings.getState().update((s) => ({ ...s, paymentMethods: change(s.paymentMethods) }))

  const add = () => {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    update((list) => [...list, { id: crypto.randomUUID(), name, builtin: false }])
  }

  return (
    <section className="app-form" aria-labelledby="settings-payment-methods">
      <h2 id="settings-payment-methods" className="app-card__title">
        {t('settings.paymentMethods')}
      </h2>
      {/* task#120：這裡只是新旅程的範本 */}
      <p className="app-field-label m-0">{t('settings.templateHint')}</p>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {methods.map((method) => (
          <MethodRow
            key={method.id}
            method={method}
            used={usage?.paymentMethods[method.id] ?? 0}
            usageKnown={usage !== null}
            onRename={(name) => update((list) => list.map((m) => (m.id === method.id ? { ...m, name } : m)))}
            onRemove={() => confirm.ask(displayName(method), 'permanent', () => update((list) => list.filter((m) => m.id !== method.id)))}
          />
        ))}
      </ul>
      <TextField
        label={t('settings.newPaymentMethod')}
        hideLabel
        placeholder={t('settings.newPaymentMethod')}
        value={newName}
        onChange={setNewName}
        trailing={
          <Button variant="ghost" onClick={add}>
            {t('settings.addPaymentMethod')}
          </Button>
        }
      />
      {confirm.dialog}
    </section>
  )
}

interface MethodRowProps {
  method: PaymentMethod
  used: number
  usageKnown: boolean
  onRename: (name: string) => void
  onRemove: () => void
}

function MethodRow({ method, used, usageKnown, onRename, onRemove }: MethodRowProps) {
  const { t, tPlural } = useI18n()
  const name = displayName(method)
  const [draft, setDraft] = useState(name)
  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) setDraft(name)
    else if (trimmed !== name) onRename(trimmed)
  }

  /*
   * 每一列都是整列寬的框，說明或刪除鍵放在框內右側（task#104）：內建列寫「內建」、
   * 有支出在用的寫使用筆數、沒人用的自訂列放刪除鍵。名稱欄不放可見標籤——一列列都是名稱
   */
  return (
    <li>
      {method.builtin ? (
        // 內建的名稱來自語言檔，不能改
        <div className="app-row">
          <span>{name}</span>
          <span className="app-row__value">{t('settings.builtin')}</span>
        </div>
      ) : (
        <TextField
          label={t('settings.paymentMethodName', { name })}
          hideLabel
          value={draft}
          onChange={setDraft}
          onBlur={commit}
          trailing={
            used > 0 ? (
              tPlural('settings.usedBy', { count: used })
            ) : usageKnown ? (
              <Button variant="ghost" aria-label={t('settings.removeItem', { name })} onClick={onRemove}>
                <Icon glyph={IconTrash} />
              </Button>
            ) : null
          }
        />
      )}
    </li>
  )
}
