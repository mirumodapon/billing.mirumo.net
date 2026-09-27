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
}

export const enUSPlurals: Record<PluralKey, { one: string; other: string }> = {
  'settle.transferCount': { one: '{count} transfer', other: '{count} transfers' },
}
