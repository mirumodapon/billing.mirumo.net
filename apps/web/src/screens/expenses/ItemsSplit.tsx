import type { OverflowRule } from '@billing/core'
import { decimalsOf, minDisplayDecimalsOf } from '@billing/core'
import { AvatarToggleGroup, Button, SegmentedControl, SwipeAction, TextField } from '@billing/ui'
import { IconTrash } from '@tabler/icons-react'
import { addItem, itemsTotals, type ItemDraft } from '../../domain/expenseDraft'
import { useI18n } from '../../i18n/useI18n'
import { useConfirmDelete } from '../forms/useConfirmDelete'
import { AmountField } from '../setup/AmountField'
import type { FormSectionProps } from './ExpenseFormScreen'

/**
 * 明細分攤（規格 3.3、4.4）：逐品項指派誰分攤。明細加總不必等於總額，差額
 * （服務費、稅、折價券）自動攤回，按比例或均分。
 */
export function ItemsSplit({ trip, draft, change, format }: FormSectionProps & { format: (v: number) => string }) {
  const { t } = useI18n()
  const confirm = useConfirmDelete()
  if (draft.split.mode !== 'items') return null
  const { items, overflowRule } = draft.split
  const { itemsTotal, overflow } = itemsTotals(draft)

  const updateItem = (id: string, update: (item: ItemDraft) => ItemDraft) =>
    change((d) => (d.split.mode === 'items' ? { ...d, split: { ...d.split, items: d.split.items.map((i) => (i.id === id ? update(i) : i)) } } : d))
  const removeItem = (id: string) =>
    change((d) => (d.split.mode === 'items' ? { ...d, split: { ...d.split, items: d.split.items.filter((i) => i.id !== id) } } : d))
  const setRule = (rule: OverflowRule) => change((d) => (d.split.mode === 'items' ? { ...d, split: { ...d.split, overflowRule: rule } } : d))

  return (
    <>
      {items.map((item, index) => {
        // 品項名可留空，顯示為「品項 N」（規格 2.3）
        const name = item.name.trim() || t('split.itemPlaceholder', { n: index + 1 })
        return (
          <SwipeAction key={item.id} glyph={IconTrash} actionLabel={t('split.removeItem', { name })} onAction={() => confirm.ask(name, 'form', () => removeItem(item.id))}>
            <div className="app-card">
              <TextField
                label={t('split.itemPlaceholder', { n: index + 1 })}
                placeholder={t('split.itemPlaceholder', { n: index + 1 })}
                value={item.name}
                onChange={(value) => updateItem(item.id, (i) => ({ ...i, name: value }))}
              />
              <AmountField
                label={t('split.itemAmount', { name })}
                value={item.amount}
                decimals={decimalsOf(draft.currency)}
                minDecimals={minDisplayDecimalsOf(draft.currency)}
                format={format}
                onChange={(amount) => updateItem(item.id, (i) => ({ ...i, amount }))}
              />
              <div className="overflow-x-auto">
                <AvatarToggleGroup
                  ariaLabel={t('split.itemPeople', { name })}
                  items={trip.members.map((m) => ({ value: m.id, name: m.name, colorKey: m.colorKey }))}
                  selected={item.participants}
                  minSelected={1}
                  onChange={(participants) => updateItem(item.id, (i) => ({ ...i, participants }))}
                />
              </div>
            </div>
          </SwipeAction>
        )
      })}
      <Button variant="secondary" onClick={() => change((d) => addItem(d, trip))}>
        {t('split.addItem')}
      </Button>
      <p role="status" className="app-field-label app-money">
        {t('split.itemsTotal', { items: format(itemsTotal), total: format(draft.amount ?? 0) })}
        {overflow !== 0 ? ` · ${t('split.overflow', { amount: format(overflow) })}` : null}
      </p>
      {overflow !== 0 ? (
        <SegmentedControl<OverflowRule>
          ariaLabel={t('split.overflowRule')}
          value={overflowRule}
          options={[
            { value: 'prorata', label: t('split.prorata') },
            { value: 'even', label: t('split.overflowEven') },
          ]}
          onChange={setRule}
        />
      ) : null}
      {confirm.dialog}
    </>
  )
}
