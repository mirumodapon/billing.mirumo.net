import type { Expense, Trip, TripPaymentMethod } from '@billing/core'
import { Accordion, Button, Icon, TextField } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useI18n } from '../../i18n/useI18n'
import { useTrips } from '../../stores/StoresProvider'

export interface TripPaymentMethodsSectionProps {
  trip: Trip
  open: boolean
  onToggle: () => void
  save: (change: (t: Trip) => Trip) => Promise<Trip | undefined>
}

// selector 每次都回新的 [] 會讓 useSyncExternalStore 以為狀態一直在變而無限重繪：剛建立、帳目還沒載入的旅程就是這樣
const NO_EXPENSES: Expense[] = []

/**
 * 只用於這趟旅程的付款方式（task#92）。版面與全域設定的付款方式相同（task#93）：
 * 框加固定寬的尾端欄，名稱欄的標籤只給輔助技術。這趟旅程還有支出在用的不能刪。
 */
export function TripPaymentMethodsSection({ trip, open, onToggle, save }: TripPaymentMethodsSectionProps) {
  const { t, tPlural } = useI18n()
  const expenses = useTrips((s) => (s.current?.tripId === trip.id ? s.current.expenses : NO_EXPENSES))
  const methods = trip.paymentMethods ?? []
  const [newName, setNewName] = useState('')

  const update = (change: (list: TripPaymentMethod[]) => TripPaymentMethod[]) =>
    void save((x) => ({ ...x, paymentMethods: change(x.paymentMethods ?? []) }))

  const add = () => {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    update((list) => [...list, { id: crypto.randomUUID(), name }])
  }

  return (
    <Accordion
      title={t('tripMethods.title')}
      summary={methods.length === 0 ? t('tripMethods.none') : methods.map((m) => m.name).join('・')}
      open={open}
      onToggle={onToggle}
      data-testid="section-trip-methods"
    >
      <div className="app-form">
        <p className="app-field-label m-0">{t('tripMethods.hint')}</p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {methods.map((method) => (
            <MethodRow
              key={method.id}
              method={method}
              used={expenses.filter((e) => !e.deletedAt && e.paymentMethodId === method.id).length}
              onRename={(name) => update((list) => list.map((m) => (m.id === method.id ? { ...m, name } : m)))}
              onRemove={() => update((list) => list.filter((m) => m.id !== method.id))}
              usedLabel={(count) => tPlural('settings.usedBy', { count })}
            />
          ))}
        </ul>
        <TextField
          label={t('tripMethods.newName')}
          hideLabel
          placeholder={t('tripMethods.newName')}
          value={newName}
          onChange={setNewName}
          trailing={
            <Button variant="ghost" onClick={add}>
              {t('tripMethods.add')}
            </Button>
          }
        />
      </div>
    </Accordion>
  )
}

interface MethodRowProps {
  method: TripPaymentMethod
  used: number
  onRename: (name: string) => void
  onRemove: () => void
  usedLabel: (count: number) => string
}

function MethodRow({ method, used, onRename, onRemove, usedLabel }: MethodRowProps) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(method.name)
  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) setDraft(method.name)
    else if (trimmed !== method.name) onRename(trimmed)
  }
  // 與全域付款方式同一個版面（task#104）：使用筆數或刪除鍵在框內右側
  return (
    <li>
      <TextField
        label={t('settings.paymentMethodName', { name: method.name })}
        hideLabel
        value={draft}
        onChange={setDraft}
        onBlur={commit}
        trailing={
          used > 0 ? (
            usedLabel(used)
          ) : (
            <Button variant="ghost" aria-label={t('settings.removeItem', { name: method.name })} onClick={onRemove}>
              <Icon glyph={IconTrash} />
            </Button>
          )
        }
      />
    </li>
  )
}
