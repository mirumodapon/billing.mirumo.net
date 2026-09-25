export const zhTW = {
  'trip.new': '新增旅程',
  'expense.splitEven': '均分',
  'settle.owes': '{from} 付給 {to}',
  'stats.myExpense': '我的支出',
} as const

export const zhTWPlurals = {
  'settle.transferCount': '{count} 筆轉帳',
} as const

export type TranslationKey = keyof typeof zhTW
export type PluralKey = keyof typeof zhTWPlurals
