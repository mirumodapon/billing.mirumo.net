import { describe, expect, it } from 'vitest'
import { createTrip, validateTripDraft, type TripDraft } from './newTrip'

const draft: TripDraft = {
  name: '京都',
  destination: '日本',
  startDate: '2026-03-14',
  endDate: '2026-03-18',
  baseCurrency: 'TWD',
  selfName: '阿明',
}

describe('validateTripDraft', () => {
  it('accepts a complete draft', () => {
    expect(validateTripDraft(draft)).toEqual([])
  })

  it('requires a name and my name, ignoring surrounding spaces', () => {
    expect(validateTripDraft({ ...draft, name: '  ', selfName: ' ' })).toEqual(['nameRequired', 'selfNameRequired'])
  })

  it('rejects an end date before the start date', () => {
    expect(validateTripDraft({ ...draft, endDate: '2026-03-13' })).toEqual(['dateOrder'])
  })

  it('allows a one-day trip', () => {
    expect(validateTripDraft({ ...draft, endDate: draft.startDate })).toEqual([])
  })
})

describe('createTrip', () => {
  it('makes me the only member, in the first identity colour', () => {
    const trip = createTrip(draft, 't1', 'm1')
    expect(trip.members).toEqual([{ id: 'm1', name: '阿明', colorKey: 'accent4' }])
    expect(trip.selfMemberId).toBe('m1')
  })

  // 規格 2.2：預算未設為 undefined，不用 0；口徑預設只看自己
  it('starts with no budget and empty rate tables', () => {
    const trip = createTrip(draft, 't1', 'm1')
    expect(trip.budget).toEqual({ scope: 'self' })
    expect(trip.rates).toEqual({ default: {}, byMethod: {} })
  })

  it('trims the names it stores', () => {
    const trip = createTrip({ ...draft, name: ' 京都 ', destination: ' 日本 ', selfName: ' 阿明 ' }, 't1', 'm1')
    expect([trip.name, trip.destination, trip.members[0]!.name]).toEqual(['京都', '日本', '阿明'])
  })

  it('gives each new trip and member its own id', () => {
    const a = createTrip(draft)
    const b = createTrip(draft)
    expect(a.id).not.toBe(b.id)
    expect(a.members[0]!.id).not.toBe(a.id)
  })
})
