import { convertToBaseMinor, decimalsOf, toMinor, type Expense, type Trip } from '@billing/core'
import { Chip, Icon, SwipeAction } from '@billing/ui'
import { IconPaperclip, IconTrash } from '@tabler/icons-react'
import type { Category } from '../../data/types'
import { categoryGlyph } from '../../domain/categories'
import { useI18n } from '../../i18n/useI18n'
import { DraftTag } from '../forms/DraftTag'
import { tripMethodName } from '../../domain/paymentMethods'

export interface ExpenseRowProps {
  expense: Expense
  trip: Trip
  category?: Category
  onOpen: () => void
  onDelete: () => void
  /** 外幣支出要不要同時顯示換算後的本位幣（task#99），預設顯示 */
  showBase?: boolean
}

/** 支出列表的一筆（規格 4.3）：類別圖示、說明、誰付與怎麼分、原幣與本位幣金額 */
export function ExpenseRow({ expense, trip, category, onOpen, onDelete, showBase = true }: ExpenseRowProps) {
  const { t, tPlural, money } = useI18n()
  const payer = trip.members.find((m) => m.id === expense.paidBy)?.name ?? ''
  const split =
    expense.split.mode === 'even'
      ? t('split.summaryEvenNoAmount', { count: expense.split.participants.length })
      : expense.split.mode === 'items'
        ? tPlural('split.summaryItems', { count: expense.split.items.length })
        : t('split.summaryExact')
  const name = expense.description.trim() || t('expense.untitled')
  const cardId = expense.topUpFor ?? (expense.fromBalance ? expense.paymentMethodId : undefined)
  const card = cardId ? trip.paymentMethods?.find((m) => m.id === cardId) : undefined
  const cardName = card ? tripMethodName(card) : undefined
  const foreign = expense.currency !== trip.baseCurrency
  const original = money(toMinor(expense.amount, decimalsOf(expense.currency)), expense.currency)
  // 草稿可能還沒有匯率（存成 0）：那時換算不出本位幣，只顯示原幣
  const base = expense.exchangeRate > 0 ? money(convertToBaseMinor(expense.amount, expense.exchangeRate, trip.baseCurrency), trip.baseCurrency) : undefined
  // 沒選類別的是問號（task#127）
  const glyph = categoryGlyph(category, expense.categoryId, expense.topUpFor !== undefined)
  const color = category?.colorKey

  return (
    <SwipeAction glyph={IconTrash} actionLabel={t('common.delete')} onAction={onDelete}>
      <button type="button" className="app-expense" data-draft={expense.draft || undefined} onClick={onOpen}>
        <span
          className="app-expense__icon"
          style={color ? { background: `var(--bi-${color})`, color: `var(--bi-${color}-fg)` } : { background: 'var(--bi-surface)' }}
        >
          <Icon glyph={glyph} />
        </span>
        <span className="app-expense__body">
          <span>
            {name}
            {expense.draft ? (
              <>
                {' '}
                <DraftTag />
              </>
            ) : null}
            {/* 預存卡（task#115）：用卡付的只扣餘額、儲值才是花費，列表上看得出是哪一種 */}
            {cardName ? (
              <>
                {' '}
                <Chip label={expense.topUpFor ? t('stored.topUpTag', { name: cardName }) : t('stored.paidWith', { name: cardName })} />
              </>
            ) : null}
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
          {foreign && showBase && base ? <span className="app-field-label m-0 block">{original}</span> : null}
          {/* 關掉本位幣時，外幣支出只顯示原幣（task#99）；本位幣支出本來就只有一個金額 */}
          <span className="block">{(foreign && !showBase) || !base ? original : base}</span>
        </span>
      </button>
    </SwipeAction>
  )
}
