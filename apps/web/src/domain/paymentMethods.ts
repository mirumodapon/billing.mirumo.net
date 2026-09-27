import type { Trip } from '@billing/core'
import type { PaymentMethod } from '../data/types'

/**
 * 這趟旅程能用的付款方式：全域的，加上只用於這趟旅程的（task#92）。
 * 旅程專用的一律當成自訂項目：名稱是使用者輸入的字面值，不翻譯。
 */
export function paymentMethodsFor(global: readonly PaymentMethod[], trip: Pick<Trip, 'paymentMethods'>): PaymentMethod[] {
  return [...global, ...(trip.paymentMethods ?? []).map((m) => ({ id: m.id, name: m.name, builtin: false }))]
}
