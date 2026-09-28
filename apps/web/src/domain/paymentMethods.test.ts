import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../data/defaults'
import { makeTrip } from '../data/testing/fixtures'
import { paymentMethodsFor } from './paymentMethods'

describe('paymentMethodsFor (task#92)', () => {
  it('lists the global methods followed by the trip’s own', () => {
    const methods = paymentMethodsFor(defaultSettings().paymentMethods, makeTrip({ paymentMethods: [{ id: 'suica', name: 'Suica' }] }))
    expect(methods.map((m) => m.id)).toEqual(['pay.cash', 'pay.credit', 'pay.mobile', 'suica'])
    expect(methods.at(-1)).toEqual({ id: 'suica', name: 'Suica', builtin: false })
  })

  it('works for trips from before the field existed', () => {
    expect(paymentMethodsFor(defaultSettings().paymentMethods, makeTrip())).toHaveLength(3)
  })
})
