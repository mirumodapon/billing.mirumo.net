import { Button, Icon, TextField } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import type { PaymentMethod } from '../../data/types'
import { displayName } from '../../domain/names'
import type { RecordUsage } from '../../domain/usage'
import { useI18n } from '../../i18n/useI18n'
import { useSettings, useStores } from '../../stores/StoresProvider'

/** 付款方式管理（規格 4.8）。沒有圖示與顏色（規格 2.1），規則同類別 */
export function PaymentMethodsSection({ usage }: { usage: RecordUsage | null }) {
  const { t } = useI18n()
  const { settings } = useStores()
  const methods = useSettings((s) => s.settings.paymentMethods)
  const [newName, setNewName] = useState('')

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
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {methods.map((method) => (
          <MethodRow
            key={method.id}
            method={method}
            used={usage?.paymentMethods[method.id] ?? 0}
            usageKnown={usage !== null}
            onRename={(name) => update((list) => list.map((m) => (m.id === method.id ? { ...m, name } : m)))}
            onRemove={() => update((list) => list.filter((m) => m.id !== method.id))}
          />
        ))}
      </ul>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField label={t('settings.newPaymentMethod')} value={newName} onChange={setNewName} />
        </div>
        <Button variant="secondary" onClick={add}>
          {t('settings.addPaymentMethod')}
        </Button>
      </div>
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

  if (method.builtin) {
    // 內建的名稱來自語言檔，不能改
    return (
      <li className="app-row">
        <span>{name}</span>
        <span className="app-row__value">{t('settings.builtin')}</span>
      </li>
    )
  }
  return (
    <li className="flex items-end gap-2">
      <div className="min-w-0 flex-1">
        <TextField label={t('settings.paymentMethodName', { name })} value={draft} onChange={setDraft} onBlur={commit} />
      </div>
      {used > 0 ? (
        <span className="app-field-label pb-3">{tPlural('settings.usedBy', { count: used })}</span>
      ) : usageKnown ? (
        <Button variant="ghost" aria-label={t('settings.removeItem', { name })} onClick={onRemove}>
          <Icon glyph={IconTrash} />
        </Button>
      ) : null}
    </li>
  )
}
