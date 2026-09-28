import type { Trip, TripPaymentMethod } from '@billing/core'
import type { PaymentMethod } from '../data/types'
import { displayName } from './names'

/** 旅程清單裡的一項轉成 app 的 PaymentMethod：內建的名稱依語系翻譯，自訂的照字面 */
export function asPaymentMethod(m: TripPaymentMethod): PaymentMethod {
  return m.builtin ? { id: m.id, builtin: true } : { id: m.id, name: m.name ?? m.id, builtin: false }
}

/** 旅程清單裡一個付款方式的顯示名稱 */
export function tripMethodName(m: TripPaymentMethod): string {
  return displayName(asPaymentMethod(m))
}

/**
 * 這趟旅程能用的付款方式。
 *
 * 有自己一份清單的旅程（task#120，建立時從全域複製）只用它自己的，全域之後怎麼改都不影響；
 * 舊旅程沿用全域的，加上只用於這趟旅程的（task#92）。
 */
export function paymentMethodsFor(global: readonly PaymentMethod[], trip: Pick<Trip, 'paymentMethods' | 'ownLists'>): PaymentMethod[] {
  const own = (trip.paymentMethods ?? []).map(asPaymentMethod)
  return trip.ownLists ? own : [...global, ...own]
}
