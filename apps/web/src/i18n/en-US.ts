import type { PluralKey, TranslationKey } from './zh-TW'

export const enUS: Record<TranslationKey, string> = {
  'trip.new': 'New Trip',
  'expense.splitEven': 'Split evenly',
  'settle.owes': '{from} pays {to}',
  'stats.myExpense': 'My spending',
}

export const enUSPlurals: Record<PluralKey, { one: string; other: string }> = {
  'settle.transferCount': { one: '{count} transfer', other: '{count} transfers' },
}
