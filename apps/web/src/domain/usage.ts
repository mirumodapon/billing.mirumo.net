import type { TripRepository } from '../data/tripRepository'

export interface RecordUsage {
  categories: Record<string, number>
  paymentMethods: Record<string, number>
}

/**
 * 每個類別與付款方式被幾筆支出引用，跨所有未刪除的旅程（Plan 6 D6）。
 * 被引用的自訂項目不能刪：刪了統計會出現沒有名字的類別。沒被引用的 id 不出現，讀的時候用 ?? 0。
 */
export async function recordUsage(repo: TripRepository): Promise<RecordUsage> {
  const usage: RecordUsage = { categories: {}, paymentMethods: {} }
  // listTrips 與 listExpenses 都已排除軟刪除的紀錄。刪除的旅程可以復原，
  // 但它的支出不該讓類別永遠刪不掉
  for (const trip of await repo.listTrips()) {
    for (const expense of await repo.listExpenses(trip.id)) {
      usage.categories[expense.categoryId] = (usage.categories[expense.categoryId] ?? 0) + 1
      usage.paymentMethods[expense.paymentMethodId] = (usage.paymentMethods[expense.paymentMethodId] ?? 0) + 1
    }
  }
  return usage
}
