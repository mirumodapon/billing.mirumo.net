import type { Expense, Transfer } from '@billing/core'

/** 這筆支出引用到的所有成員 id：付款人與每一種分攤模式裡的參與者 */
export function membersOfExpense(expense: Expense): Set<string> {
  const ids = new Set<string>([expense.paidBy])
  const split = expense.split
  if (split.mode === 'even') for (const id of split.participants) ids.add(id)
  else if (split.mode === 'exact') for (const id of Object.keys(split.amounts)) ids.add(id)
  else for (const item of split.items) for (const id of item.participants) ids.add(id)
  return ids
}

export function membersOfTransfer(transfer: Transfer): Set<string> {
  return new Set([transfer.from, transfer.to])
}
