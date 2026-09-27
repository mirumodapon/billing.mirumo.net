import type { Trip } from '@billing/core'
import { pickAccent } from '@billing/ui'

/** 新增旅程的 sheet 只問這幾樣（Plan 6 D5），其餘到設定 tab 補 */
export interface TripDraft {
  name: string
  destination: string
  startDate: string
  endDate: string
  baseCurrency: string
  /** 建立者自己的名字，成為第一位成員與「我」 */
  selfName: string
}

export type TripDraftError = 'nameRequired' | 'selfNameRequired' | 'dateOrder'

export function validateTripDraft(d: TripDraft): TripDraftError[] {
  const errors: TripDraftError[] = []
  if (!d.name.trim()) errors.push('nameRequired')
  if (!d.selfName.trim()) errors.push('selfNameRequired')
  // 'YYYY-MM-DD' 可以直接比字串，不必解析日期
  if (d.endDate < d.startDate) errors.push('dateOrder')
  return errors
}

/** 時間戳留空：由 Repository 蓋（規格 7.1），呼叫端傳什麼都會被忽略 */
export function createTrip(d: TripDraft, id: string = crypto.randomUUID(), memberId: string = crypto.randomUUID()): Trip {
  return {
    id,
    name: d.name.trim(),
    destination: d.destination.trim(),
    startDate: d.startDate,
    endDate: d.endDate,
    baseCurrency: d.baseCurrency,
    members: [{ id: memberId, name: d.selfName.trim(), colorKey: pickAccent([]) }],
    selfMemberId: memberId,
    budget: { scope: 'self' },
    rates: { default: {}, byMethod: {} },
    createdAt: '',
    updatedAt: '',
  }
}
