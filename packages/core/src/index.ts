export const CORE_VERSION = '0.0.0'

export type * from './types'

/**
 * 公開介面刻意只列出消費端真正需要的東西，不用 `export *`。
 *
 * 被擋在外面的是整數配置基元：`splitEven`、`reconcile`、`distribute`、
 * `sortByMemberOrder`、`splitExact`、`splitByItems`、`itemShares`。它們有
 * 型別簽章表達不出來的前置條件——最要緊的是 `splitEven` 要求 participants
 * 已依 memberOrder 排序。`sharesOf` 與 `splitByItems` 都有遵守，但一個「即時
 * 分帳預覽」元件若拿勾選順序去呼叫它，可重現性保證會在那個呼叫點靜靜失效，
 * 而且沒有任何測試抓得到。全部經由 `sharesOf` 進來就不會有這個問題。
 */

export { CURRENCY_DECIMALS, convertToBaseMinor, decimalsOf, fromMinor, toMinor } from './money'

export { countsInTotals, isLive } from './records'

export { sharesOf } from './split'

export { minimalTransfers, netBalances } from './settle'
export type { Balance, TransferSuggestion } from './settle'

export { rateKey, resolveRate } from './fx'

export { budgetStatus, byCategory, byDay, contributionOf, itemBreakdown } from './stats'
export type {
  BudgetStatus,
  ByCategoryOptions,
  ByDayOptions,
  CategoryStat,
  DayStat,
  ItemBreakdown,
  ItemBreakdownOptions,
  ItemShare,
  StatsOptions,
} from './stats'
