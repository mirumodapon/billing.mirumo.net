import type { Expense, Trip } from '@billing/core'
import { TextField } from '@billing/ui'
import { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { BootSkeleton } from '../../app/BootSkeleton'
import { todayIso } from '../../domain/dates'
import {
  draftFromExpense,
  isExpenseDraft,
  newDraft,
  problemsOf,
  toExpense,
  withAutoRate,
  withManualRate,
  type ExpenseDraft,
} from '../../domain/expenseDraft'
import { useI18n } from '../../i18n/useI18n'
import { useStores, useTrips } from '../../stores/StoresProvider'
import { useOpenTrip } from '../useOpenTrip'
import { MoneyInput } from '../forms/MoneyInput'
import { DetailsSection } from './DetailsSection'
import { ReceiptSection } from './ReceiptSection'
import { SplitSection } from './SplitSection'
import { FormShell } from '../forms/FormShell'
import { useFormDraft } from '../forms/useFormDraft'

/** 新增（/expense/new）或編輯（/expense/:id）支出的全螢幕表單（規格 4.4） */
export function ExpenseFormScreen() {
  const { tripId = '', expenseId = 'new' } = useParams()
  const ready = useOpenTrip(tripId)
  const trip = useTrips((s) => s.trips.find((t) => t.id === tripId))
  const existing = useTrips((s) => (expenseId === 'new' ? undefined : s.current?.expenses.find((e) => e.id === expenseId)))

  if (!trip) return <Navigate to="/" replace />
  if (!ready) return <BootSkeleton />
  // 要編輯的那一筆不在了（已刪除、或是別的旅程的 id）：回列表，不顯示錯誤
  if (expenseId !== 'new' && !existing) return <Navigate to={`/trip/${tripId}/expenses`} replace />
  return <ExpenseForm key={expenseId} trip={trip} existing={existing} />
}

export interface FormSectionProps {
  trip: Trip
  draft: ExpenseDraft
  change: (update: (d: ExpenseDraft) => ExpenseDraft) => void
}

function ExpenseForm({ trip, existing }: { trip: Trip; existing?: Expense }) {
  const { t } = useI18n()
  const location = useLocation()
  const { trips, settings } = useStores()
  const [initial] = useState<ExpenseDraft>(() =>
    existing
      ? draftFromExpense(existing)
      : newDraft({ trip, expenses: trips.getState().current?.expenses ?? [], settings: settings.getState().settings, today: todayIso() }),
  )
  const drafted = useFormDraft(location.pathname, initial, isExpenseDraft)
  // 規格 4.4：一次只展開一個區塊，而且每次打開表單都從全部收起開始。不記在 session 裡：
  // 上一筆展開過分攤，不代表下一筆也要——那會讓「不必展開任何區塊」的預設狀態消失
  const [openSection, setOpenSection] = useState<string>()
  const sections = { open: openSection, toggle: (key: string) => setOpenSection((o) => (o === key ? undefined : key)) }

  if (!drafted.ready) return <BootSkeleton />
  const { draft, setDraft: change } = drafted

  const save = async () => {
    const saved = await trips.getState().saveExpense(toExpense(draft, trip.id))
    if (!saved) return false
    // 規格 4.4 的「上一筆用的類別／付款方式」。只在新增時記：打開舊帳改個錯字不該改掉下一筆的預設值。
    // 失敗只影響下一筆的預設值，支出本身已經存好了
    if (!existing) {
      void settings.getState().update((s) => ({
        ...s,
        lastUsed: { currency: saved.currency, categoryId: saved.categoryId, paymentMethodId: saved.paymentMethodId },
      }))
    }
    return true
  }

  return (
    <FormShell
      title={existing ? t('expense.edit') : t('expense.new')}
      incomplete={problemsOf(draft).length > 0}
      isDraft={draft.isDraft === true}
      onDraftChange={(isDraft) => change((d) => ({ ...d, isDraft }))}
      onSave={save}
      drafted={drafted}
      fallback={`/trip/${trip.id}/expenses`}
    >
      {(version) => (
        <div key={version} className="app-form">
          <MoneyInput
            baseCurrency={trip.baseCurrency}
            currency={draft.currency}
            amount={draft.amount}
            exchangeRate={draft.exchangeRate}
            autoFocus={!existing}
            onAmount={(amount) => change((d) => ({ ...d, amount }))}
            onCurrency={(currency) => change((d) => withAutoRate({ ...d, currency }, trip))}
            onManualRate={(rate) => change((d) => withManualRate(d, rate))}
          />
          <TextField label={t('expense.description')} value={draft.description} onChange={(description) => change((d) => ({ ...d, description }))} />
          <DetailsSection trip={trip} draft={draft} change={change} open={sections.open === 'details'} onToggle={() => sections.toggle('details')} />
          <SplitSection trip={trip} draft={draft} change={change} open={sections.open === 'split'} onToggle={() => sections.toggle('split')} />
          <ReceiptSection trip={trip} draft={draft} change={change} open={sections.open === 'receipt'} onToggle={() => sections.toggle('receipt')} />
        </div>
      )}
    </FormShell>
  )
}
