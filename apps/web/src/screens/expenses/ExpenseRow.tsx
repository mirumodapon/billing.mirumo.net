import { convertToBaseMinor, decimalsOf, toMinor, type Expense, type Trip } from '@billing/core'
import { CATEGORY_ICONS, Icon, SwipeAction } from '@billing/ui'
import { IconDots, IconPaperclip, IconTrash } from '@tabler/icons-react'
import type { Category } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'

export interface ExpenseRowProps {
  expense: Expense
  trip: Trip
  category?: Category
  onOpen: () => void
  onDelete: () => void
}

/** 支出列表的一筆（規格 4.3）：類別圖示、說明、誰付與怎麼分、原幣與本位幣金額 */
export function ExpenseRow({ expense, trip, category, onOpen, onDelete }: ExpenseRowProps) {
  const { t, tPlural, money } = useI18n()
  const payer = trip.members.find((m) => m.id === expense.paidBy)?.name ?? ''
  const split =
    expense.split.mode === 'even'
      ? t('split.summaryEvenNoAmount', { count: expense.split.participants.length })
      : expense.split.mode === 'items'
        ? tPlural('split.summaryItems', { count: expense.split.items.length })
        : t('split.summaryExact')
  const name = expense.description.trim() || t('expense.untitled')
  const foreign = expense.currency !== trip.baseCurrency
  const glyph = category ? CATEGORY_ICONS[category.icon] : IconDots
  const color = category?.colorKey

  return (
    <SwipeAction glyph={IconTrash} actionLabel={t('common.delete')} onAction={onDelete}>
      <button type="button" className="app-expense" onClick={onOpen}>
        <span
          className="app-expense__icon"
          style={color ? { background: `var(--bi-${color})`, color: `var(--bi-${color}-fg)` } : { background: 'var(--bi-surface)' }}
        >
          <Icon glyph={glyph} />
        </span>
        <span className="app-expense__body">
          <span>
            {name}
            {expense.attachments.length > 0 ? (
              <>
                {' '}
                <Icon glyph={IconPaperclip} size="sm" ariaLabel={t('expenses.hasReceipt')} />
              </>
            ) : null}
          </span>
          <span className="app-field-label m-0">{t('expenses.paidSplit', { payer, split })}</span>
        </span>
        <span className="app-expense__amounts">
          {foreign ? (
            <span className="app-field-label m-0 block">{money(toMinor(expense.amount, decimalsOf(expense.currency)), expense.currency)}</span>
          ) : null}
          <span className="block">{money(convertToBaseMinor(expense.amount, expense.exchangeRate, trip.baseCurrency), trip.baseCurrency)}</span>
        </span>
      </button>
    </SwipeAction>
  )
}
