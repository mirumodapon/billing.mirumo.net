import { decimalsOf, toMinor } from '@billing/core'
import { Accordion, AvatarToggleGroup, Button, SegmentedControl } from '@billing/ui'
import { useState } from 'react'
import { exactAllocation, previewShares, type SplitDraft } from '../../domain/expenseDraft'
import { useI18n } from '../../i18n/useI18n'
import { AmountField } from '../setup/AmountField'
import type { FormSectionProps } from './ExpenseFormScreen'
import { ItemsSplit } from './ItemsSplit'

type Mode = SplitDraft['mode']

/**
 * 分攤（規格 4.4）。三種模式各自保留上次的內容：切到指定金額看一眼再切回均分，
 * 勾好的人不該被清掉。
 */
export function SplitSection({ trip, draft, change, open, onToggle }: FormSectionProps & { open: boolean; onToggle: () => void }) {
  const { t, tPlural, money } = useI18n()
  const [memory, setMemory] = useState<Partial<Record<Mode, SplitDraft>>>({})
  const split = draft.split
  const format = (v: number) => money(toMinor(v, decimalsOf(draft.currency)), draft.currency)

  const switchTo = (mode: Mode) => {
    if (mode === split.mode) return
    setMemory((m) => ({ ...m, [split.mode]: split }))
    const next: SplitDraft =
      memory[mode] ??
      (mode === 'even'
        ? { mode: 'even', participants: trip.members.map((m) => m.id) }
        : mode === 'exact'
          ? { mode: 'exact', amounts: {} }
          : { mode: 'items', items: [], overflowRule: 'prorata' })
    change((d) => ({ ...d, split: next }))
  }

  const shares = previewShares(draft, trip)
  const summary =
    split.mode === 'even'
      ? shares && draft.amount
        ? t('split.summaryEven', {
            count: split.participants.length,
            // 除不盡時有人多 1 分：顯示多的那個，不讓人以為少付了
            amount: money(Math.max(...Object.values(shares)), trip.baseCurrency),
          })
        : t('split.summaryEvenNoAmount', { count: split.participants.length })
      : split.mode === 'items'
        ? tPlural('split.summaryItems', { count: split.items.length })
        : t('split.summaryExact')

  return (
    <Accordion title={t('split.title')} summary={summary} open={open} onToggle={onToggle} data-testid="section-split">
      <div className="app-form">
        <SegmentedControl<Mode>
          ariaLabel={t('split.mode')}
          value={split.mode}
          options={[
            { value: 'even', label: t('expense.splitEven') },
            { value: 'items', label: t('split.items') },
            { value: 'exact', label: t('split.exact') },
          ]}
          onChange={switchTo}
        />
        {split.mode === 'even' ? <EvenSplit {...{ trip, draft, change }} /> : null}
        {split.mode === 'exact' ? <ExactSplit {...{ trip, draft, change, format }} /> : null}
        {split.mode === 'items' ? <ItemsSplit {...{ trip, draft, change, format }} /> : null}
      </div>
    </Accordion>
  )
}

/**
 * 均分的參與者，附「僅付款人／全選／全不選」（task#105）。可以一個人都不選：
 * 那時表單會把這筆存成草稿（task#96），不必硬留一個人。
 */
function EvenSplit({ trip, draft, change }: FormSectionProps) {
  const { t } = useI18n()
  if (draft.split.mode !== 'even') return null
  const set = (participants: string[]) => change((d) => ({ ...d, split: { mode: 'even', participants } }))
  return (
    <>
      <div role="group" aria-label={t('split.quick')} className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => set([draft.paidBy])}>
          {t('split.onlyPayer')}
        </Button>
        <Button variant="secondary" onClick={() => set(trip.members.map((m) => m.id))}>
          {t('split.everyone')}
        </Button>
        <Button variant="secondary" onClick={() => set([])}>
          {t('split.none')}
        </Button>
      </div>
      <AvatarToggleGroup
        ariaLabel={t('split.participants')}
        items={trip.members.map((m) => ({ value: m.id, name: m.name, colorKey: m.colorKey }))}
        selected={draft.split.participants}
        onChange={set}
      />
    </>
  )
}

function ExactSplit({ trip, draft, change, format }: FormSectionProps & { format: (v: number) => string }) {
  const { t } = useI18n()
  if (draft.split.mode !== 'exact') return null
  const amounts = draft.split.amounts
  const { allocated, remaining } = exactAllocation(draft)
  return (
    <>
      {trip.members.map((m) => (
        <AmountField
          key={m.id}
          label={m.name}
          value={amounts[m.id]}
          decimals={decimalsOf(draft.currency)}
          format={format}
          onChange={(value) =>
            change((d) => (d.split.mode === 'exact' ? { ...d, split: { mode: 'exact', amounts: { ...d.split.amounts, [m.id]: value } } } : d))
          }
        />
      ))}
      <p role="status" className="app-field-label app-money">
        {t('split.allocated', { allocated: format(allocated), total: format(draft.amount ?? 0) })}
        {remaining > 0 ? ` · ${t('split.remaining', { amount: format(remaining) })}` : null}
        {remaining < 0 ? ` · ${t('split.over', { amount: format(-remaining) })}` : null}
      </p>
    </>
  )
}
