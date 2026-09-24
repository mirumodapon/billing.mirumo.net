import { describe, expect, it } from 'vitest'
import { CORE_VERSION } from './index'

describe('@billing/core', () => {
  it('exposes a version marker', () => {
    expect(CORE_VERSION).toBe('0.0.0')
  })
})
