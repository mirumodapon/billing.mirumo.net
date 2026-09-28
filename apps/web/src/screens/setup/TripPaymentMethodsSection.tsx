import type { Expense, Trip, TripPaymentMethod } from '@billing/core'
import { Accordion, Button, Chip, Icon, SheetPicker, TextField } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CURRENCIES, currencyName } from '../../domain/currencies'
import { storedBalances, type StoredBalance } from '../../domain/storedValue'
import { useI18n } from '../../i18n/useI18n'
import { useTrips } from '../../stores/StoresProvider'
import { useConfirmDelete } from '../forms/useConfirmDelete'

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
 * 也可以設成預存卡（task#115）：顯示餘額、可以儲值。有紀錄之後預存設定就鎖住，
 * 否則已經蓋好的「從餘額扣」會與設定對不起來。
 */
export function TripPaymentMethodsSection({ trip, open, onToggle, save }: TripPaymentMethodsSectionProps) {
  const { t, tPlural, locale } = useI18n()
  const navigate = useNavigate()
  const expenses = useTrips((s) => (s.current?.tripId === trip.id ? s.current.expenses : NO_EXPENSES))
  const methods = trip.paymentMethods ?? []
  const confirm = useConfirmDelete()
  const [newName, setNewName] = useState('')
  const [pickingCurrencyFor, setPickingCurrencyFor] = useState<string | null>(null)
  const balances = storedBalances(trip, expenses)

  const update = (change: (list: TripPaymentMethod[]) => TripPaymentMethod[]) =>
    void save((x) => ({ ...x, paymentMethods: change(x.paymentMethods ?? []) }))
  const setStored = (id: string, storedValue: TripPaymentMethod['storedValue']) =>
    update((list) =>
      list.map((m) => {
        if (m.id !== id) return m
        const next: TripPaymentMethod = { id: m.id, name: m.name }
        return storedValue ? { ...next, storedValue } : next
      }),
    )

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
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {methods.map((method) => {
            const live = expenses.filter((e) => !e.deletedAt)
            const paid = live.filter((e) => e.paymentMethodId === method.id).length
            const topUps = live.filter((e) => e.topUpFor === method.id).length
            return (
              <MethodRow
                key={method.id}
                method={method}
                used={paid + topUps}
                balance={balances[method.id]}
                onRename={(name) => update((list) => list.map((m) => (m.id === method.id ? { ...m, name } : m)))}
                onRemove={() => confirm.ask(method.name, 'permanent', () => update((list) => list.filter((m) => m.id !== method.id)))}
                onStoredToggle={() => (method.storedValue ? setStored(method.id, undefined) : setPickingCurrencyFor(method.id))}
                onTopUp={() => navigate(`/trip/${trip.id}/expense/new?topUp=${method.id}`)}
                usedLabel={(count) => tPlural('settings.usedBy', { count })}
              />
            )
          })}
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
        <SheetPicker
          open={pickingCurrencyFor !== null}
          title={t('stored.currency')}
          options={CURRENCIES.map((c) => ({ value: c, label: `${c} · ${currencyName(c, locale)}` }))}
          value=""
          onSelect={(currency) => {
            if (pickingCurrencyFor) setStored(pickingCurrencyFor, { currency })
            setPickingCurrencyFor(null)
          }}
          onClose={() => setPickingCurrencyFor(null)}
        />
        {confirm.dialog}
      </div>
    </Accordion>
  )
}

interface MethodRowProps {
  method: TripPaymentMethod
  /** 這趟旅程裡用它付款、或替它儲值的筆數（不含刪除的） */
  used: number
  balance?: StoredBalance
  onRename: (name: string) => void
  onRemove: () => void
  onStoredToggle: () => void
  onTopUp: () => void
  usedLabel: (count: number) => string
}

function MethodRow({ method, used, balance, onRename, onRemove, onStoredToggle, onTopUp, usedLabel }: MethodRowProps) {
  const { t, money } = useI18n()
  const [draft, setDraft] = useState(method.name)
  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) setDraft(method.name)
    else if (trimmed !== method.name) onRename(trimmed)
  }
  // 與全域付款方式同一個版面（task#104）：使用筆數或刪除鍵在框內右側
  return (
    <li className="flex flex-col gap-2">
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
      <div className="flex flex-wrap items-center gap-2" data-testid={`stored-${method.id}`}>
        {/* 有紀錄之後不能改：已經蓋好的「從餘額扣」會與設定對不起來 */}
        <Chip
          label={method.storedValue ? t('stored.label', { currency: method.storedValue.currency }) : t('stored.make')}
          selected={method.storedValue !== undefined}
          disabled={used > 0}
          onSelect={onStoredToggle}
          aria-label={t('stored.toggle', { name: method.name })}
        />
        {method.storedValue && balance ? (
          <>
            <span className="app-money" data-testid={`balance-${method.id}`}>
              {t('stored.balance', { amount: money(balance.minor, balance.currency) })}
            </span>
            <Button variant="secondary" onClick={onTopUp}>
              {t('stored.topUp')}
            </Button>
          </>
        ) : null}
      </div>
    </li>
  )
}
