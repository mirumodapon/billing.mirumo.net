import { describe, expect, it } from 'vitest'
import { UI_VERSION } from './index'

describe('@billing/ui', () => {
  it('exposes a version marker', () => {
    expect(UI_VERSION).toBe('0.0.0')
  })
})
