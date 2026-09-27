export const zhTW = {
  'trip.new': '新增旅程',
  'expense.splitEven': '均分',
  'settle.owes': '{from} 付給 {to}',
  'stats.myExpense': '我的支出',
  // 內建類別與付款方式的 id 就是這些 key（規格 13.6），存 id 而不是字面值，
  // 切換語系時名稱才會跟著變
  'cat.food': '餐飲',
  'cat.transport': '交通',
  'cat.lodging': '住宿',
  'cat.shopping': '購物',
  'cat.ticket': '票券',
  'cat.other': '其他',
  'pay.cash': '現金',
  'pay.credit': '信用卡',
  'pay.mobile': '行動支付',
  'error.saveFailed': '儲存失敗，已還原變更',
  'error.loadFailed': '讀取資料失敗',
  'tripList.deleted': '已刪除「{name}」',
  'common.undo': '復原',
} as const

export const zhTWPlurals = {
  'settle.transferCount': '{count} 筆轉帳',
} as const

export type TranslationKey = keyof typeof zhTW
export type PluralKey = keyof typeof zhTWPlurals
