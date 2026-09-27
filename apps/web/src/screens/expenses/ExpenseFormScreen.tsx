import type { Expense, Trip } from '@billing/core'
import { Button, Icon, SafeArea, TextField } from '@billing/ui'
import { IconX } from '@tabler/icons-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { BootSkeleton } from '../../app/BootSkeleton'
import { todayIso } from '../../domain/dates'
import { draftFromExpense, newDraft, problemsOf, toExpense, type ExpenseDraft } from '../../domain/expenseDraft'
import { useI18n } from '../../i18n/useI18n'
import { useStores, useTrips } from '../../stores/StoresProvider'
import { useOpenTrip } from '../useOpenTrip'
import { useOpenSection } from '../setup/useOpenSection'
import { AmountSection } from './AmountSection'
import { DetailsSection } from './DetailsSection'
import { ReceiptSection } from './ReceiptSection'
import { SplitSection } from './SplitSection'

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
  const navigate = useNavigate()
  const location = useLocation()
  const { trips, settings } = useStores()
  const [draft, setDraft] = useState<ExpenseDraft>(() =>
    existing
      ? draftFromExpense(existing)
      : newDraft({ trip, expenses: trips.getState().current?.expenses ?? [], settings: settings.getState().settings, today: todayIso() }),
  )
  const change = (update: (d: ExpenseDraft) => ExpenseDraft) => setDraft(update)
  // 規格 4.4：一次只展開一個區塊
  const sections = useOpenSection()
  const canSave = problemsOf(draft).length === 0

  // 從旅程頁推進來的就退回去；直接由 session 還原進來、前面沒有頁面時，改去支出列表
  const leave = () => (location.key !== 'default' ? navigate(-1) : navigate(`/trip/${trip.id}/expenses`, { replace: true }))

  const save = async () => {
    if (await trips.getState().saveExpense(toExpense(draft, trip.id))) leave()
  }

  return (
    <div className="app-screen">
      <SafeArea edges={['top', 'left', 'right']}>
        <header className="app-form-header">
          <Button variant="ghost" aria-label={t('expense.close')} onClick={leave}>
            <Icon glyph={IconX} />
          </Button>
          <h1 className="app-form-header__title">{existing ? t('expense.edit') : t('expense.new')}</h1>
          <Button disabled={!canSave} onClick={() => void save()}>
            {t('expense.save')}
          </Button>
        </header>
      </SafeArea>
      <div className="app-scroll">
        <div className="app-form">
          <AmountSection trip={trip} draft={draft} change={change} autoFocus={!existing} />
          <TextField label={t('expense.description')} value={draft.description} onChange={(description) => change((d) => ({ ...d, description }))} />
          <DetailsSection trip={trip} draft={draft} change={change} open={sections.open === 'details'} onToggle={() => sections.toggle('details')} />
          <SplitSection trip={trip} draft={draft} change={change} open={sections.open === 'split'} onToggle={() => sections.toggle('split')} />
          <ReceiptSection trip={trip} draft={draft} change={change} open={sections.open === 'receipt'} onToggle={() => sections.toggle('receipt')} />
        </div>
      </div>
    </div>
  )
}
