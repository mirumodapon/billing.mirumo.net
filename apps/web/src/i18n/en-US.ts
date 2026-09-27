import type { PluralKey, TranslationKey } from './zh-TW'

export const enUS: Record<TranslationKey, string> = {
  'trip.new': 'New Trip',
  'expense.splitEven': 'Split evenly',
  'settle.owes': '{from} pays {to}',
  'stats.myExpense': 'My spending',
  'cat.food': 'Food',
  'cat.transport': 'Transport',
  'cat.lodging': 'Lodging',
  'cat.shopping': 'Shopping',
  'cat.ticket': 'Tickets',
  'cat.other': 'Other',
  'pay.cash': 'Cash',
  'pay.credit': 'Credit card',
  'pay.mobile': 'Mobile pay',
  'error.saveFailed': "Couldn't save. Your change was undone.",
  'error.loadFailed': "Couldn't load your data.",
  'tripList.deleted': 'Deleted "{name}"',
  'common.undo': 'Undo',
  'common.back': 'Back',
  'tab.expenses': 'Expenses',
  'tab.stats': 'Stats',
  'tab.settle': 'Settle',
  'tab.setup': 'Setup',
  'tab.label': 'Trip sections',
  'placeholder.comingSoon': 'This page arrives in the next version',
  'tripList.title': 'My trips',
  'settings.title': 'Settings',
  'common.loading': 'Loading',
}

export const enUSPlurals: Record<PluralKey, { one: string; other: string }> = {
  'settle.transferCount': { one: '{count} transfer', other: '{count} transfers' },
}
