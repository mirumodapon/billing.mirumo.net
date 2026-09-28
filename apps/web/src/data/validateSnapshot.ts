import type { Expense, Transfer, Trip } from '@billing/core'
import { isValidIso } from '@billing/ui'
import { membersOfExpense, membersOfTransfer } from './references'
import { APP_ID, SNAPSHOT_VERSION, type Snapshot } from './types'

export type SnapshotCheck = { ok: true; snapshot: Snapshot } | { ok: false; problems: string[] }

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isAmount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isRate = (v: unknown): v is number => isAmount(v) && v > 0

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const id of ids) (seen.has(id) ? dup : seen).add(id)
  return [...dup]
}

/**
 * 檢查一份備份能不能安全地寫進資料庫。
 *
 * 手改過的檔案不受 UI 的任何驗證保護（task#61），所以這裡要擋下 core 假設不會
 * 發生的一切：引用不存在的旅程、成員、類別或付款方式，非有限的金額，不合法的
 * 日期。任何一條不過就整份拒絕——寫進一半的備份比不寫更糟。
 *
 * 已軟刪除的紀錄不檢查成員引用：刪掉紀錄之後本來就可以移除那位成員，
 * 墓碑引用一個已不存在的人是合法狀態。
 */
export function validateSnapshot(input: unknown): SnapshotCheck {
  const problems: string[] = []
  if (!isObject(input)) return { ok: false, problems: ['not a backup file'] }
  if (input.app !== APP_ID) problems.push('not a backup made by this app')
  if (input.schemaVersion !== SNAPSHOT_VERSION) {
    problems.push(`unsupported backup version ${String(input.schemaVersion)}`)
  }
  const settings = input.settings
  if (!isObject(settings) || !Array.isArray(settings.categories) || !Array.isArray(settings.paymentMethods)) {
    problems.push('settings are missing or malformed')
  }
  for (const key of ['trips', 'expenses', 'transfers'] as const) {
    if (!Array.isArray(input[key])) problems.push(`${key} is not a list`)
  }
  // 結構不對就別往下查引用，否則會噴出一長串衍生的錯誤訊息
  if (problems.length > 0) return { ok: false, problems }

  const trips = input.trips as Trip[]
  const expenses = input.expenses as Expense[]
  const transfers = input.transfers as Transfer[]
  const s = settings as unknown as Snapshot['settings']
  const categoryIds = new Set(s.categories.map((c) => c.id))
  const methodIds = new Set(s.paymentMethods.map((p) => p.id))

  for (const [kind, rows] of [['trip', trips], ['expense', expenses], ['transfer', transfers]] as const) {
    for (const id of duplicates(rows.map((r) => r.id))) problems.push(`${kind} id ${id} appears more than once`)
  }

  const membersByTrip = new Map<string, Set<string>>()
  for (const trip of trips) {
    const at = `trip ${trip.id}`
    if (!isText(trip.id)) problems.push('a trip has no id')
    if (!isValidIso(trip.startDate) || !isValidIso(trip.endDate)) problems.push(`${at}: invalid dates`)
    else if (trip.startDate > trip.endDate) problems.push(`${at}: ends before it starts`)
    if (!isText(trip.baseCurrency)) problems.push(`${at}: no base currency`)
    const members = Array.isArray(trip.members) ? trip.members : []
    if (members.length === 0) problems.push(`${at}: has no members`)
    for (const id of duplicates(members.map((m) => m.id))) problems.push(`${at}: member ${id} appears more than once`)
    const ids = new Set(members.map((m) => m.id))
    if (!ids.has(trip.selfMemberId)) problems.push(`${at}: selfMemberId ${trip.selfMemberId} is not a member`)
    // task#92：旅程專用的付款方式是選填的；有的話每一筆都要有 id 與名稱，id 不能重複
    if (trip.paymentMethods !== undefined) {
      const methods = Array.isArray(trip.paymentMethods) ? trip.paymentMethods : []
      // 預存卡（task#115）要帶幣別
      const badStored = (m: { storedValue?: unknown }) =>
        m.storedValue !== undefined && (!isObject(m.storedValue) || !isText((m.storedValue as { currency?: unknown }).currency))
      if (!Array.isArray(trip.paymentMethods) || methods.some((m) => !isText(m?.id) || typeof m?.name !== 'string' || badStored(m))) {
        problems.push(`${at}: malformed payment methods`)
      }
      for (const id of duplicates(methods.map((m) => m?.id))) problems.push(`${at}: payment method ${id} appears more than once`)
    }
    // task#114：旅程專用的類別，規則同上；圖示名稱畫面會自己退回預設，這裡只要求是字串
    if (trip.categories !== undefined) {
      const categories = Array.isArray(trip.categories) ? trip.categories : []
      if (
        !Array.isArray(trip.categories) ||
        categories.some((c) => !isText(c?.id) || typeof c?.name !== 'string' || typeof c?.icon !== 'string' || typeof c?.colorKey !== 'string')
      ) {
        problems.push(`${at}: malformed categories`)
      }
      for (const id of duplicates(categories.map((c) => c?.id))) problems.push(`${at}: category ${id} appears more than once`)
    }
    membersByTrip.set(trip.id, ids)
  }

  const checkRecord = (at: string, record: Expense | Transfer, referenced: Set<string>) => {
    if (!isValidIso(record.date)) problems.push(`${at}: invalid date`)
    if (!isAmount(record.amount)) problems.push(`${at}: amount is not a number`)
    // 草稿可以還沒有匯率（存成 0，task#96）；完成的紀錄一定要有
    if (record.draft !== undefined && typeof record.draft !== 'boolean') problems.push(`${at}: draft must be true or false`)
    if (!isRate(record.exchangeRate) && !(record.draft === true && record.exchangeRate === 0)) {
      problems.push(`${at}: exchange rate must be a positive number`)
    }
    const members = membersByTrip.get(record.tripId)
    if (!members) {
      problems.push(`${at}: trip ${record.tripId} does not exist`)
      return
    }
    if (record.deletedAt) return
    for (const id of [...referenced].sort()) {
      if (!members.has(id)) problems.push(`${at}: member ${id} is not in trip ${record.tripId}`)
    }
  }

  for (const expense of expenses) {
    const at = `expense ${expense.id}`
    const mode = isObject(expense.split) ? expense.split.mode : undefined
    if (mode !== 'even' && mode !== 'exact' && mode !== 'items') {
      problems.push(`${at}: unknown split mode ${String(mode)}`)
      continue
    }
    checkRecord(at, expense, membersOfExpense(expense))
    // 旅程專用的類別也算，但只限這筆支出自己的旅程（task#114）
    const tripCategories = trips.find((trip) => trip.id === expense.tripId)?.categories ?? []
    // 類別不帶入之後，還沒選類別的草稿類別是空字串；完成的紀錄一定要有
    const unchosenDraft = expense.draft === true && expense.categoryId === ''
    if (!unchosenDraft && !categoryIds.has(expense.categoryId) && !tripCategories.some((c) => c?.id === expense.categoryId)) {
      problems.push(`${at}: category ${expense.categoryId} does not exist`)
    }
    // task#115：用預存卡付的旗標；儲值的對象必須是這趟旅程的預存卡
    if (expense.fromBalance !== undefined && typeof expense.fromBalance !== 'boolean') problems.push(`${at}: fromBalance must be true or false`)
    if (expense.topUpFor !== undefined) {
      const stored = (trips.find((trip) => trip.id === expense.tripId)?.paymentMethods ?? []).filter((m) => m?.storedValue)
      if (!stored.some((m) => m.id === expense.topUpFor)) {
        problems.push(`${at}: tops up ${String(expense.topUpFor)}, which is not a stored-value card of trip ${expense.tripId}`)
      }
    }
    // 旅程專用的付款方式也算（task#92）
    const tripMethods = trips.find((trip) => trip.id === expense.tripId)?.paymentMethods ?? []
    if (!methodIds.has(expense.paymentMethodId) && !tripMethods.some((m) => m?.id === expense.paymentMethodId)) {
      problems.push(`${at}: payment method ${expense.paymentMethodId} does not exist`)
    }
  }

  for (const transfer of transfers) {
    const at = `transfer ${transfer.id}`
    checkRecord(at, transfer, membersOfTransfer(transfer))
    // 草稿可以還沒選好對象（task#96）
    if (transfer.from === transfer.to && transfer.draft !== true) problems.push(`${at}: sends money to the same person`)
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, snapshot: input as unknown as Snapshot }
}
