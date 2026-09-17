import { describe, it, expect } from 'vitest'
import { effectiveHp } from '../../src/analysis/effective-hp'
import type { StatSheet } from '../../src/resolve-stats'

function sheetWith(total: Partial<StatSheet['total']>): StatSheet {
  return {
    base: {}, bonus: {}, total, breakdown: [],
    unsupportedEffects: [], dataWarnings: [], unverifiedRules: [],
  }
}

describe('effectiveHp', () => {
  it('returns hp unchanged against zero resist', () => {
    const result = effectiveHp(sheetWith({ hp: 1000, armor: 0, mr: 0 }))
    expect(result).toEqual({ physical: 1000, magic: 1000 })
  })

  it('doubles effective hp at 100 armor/mr', () => {
    const result = effectiveHp(sheetWith({ hp: 1000, armor: 100, mr: 100 }))
    expect(result.physical).toBeCloseTo(2000)
    expect(result.magic).toBeCloseTo(2000)
  })

  it('computes physical and magic independently from different resists', () => {
    const result = effectiveHp(sheetWith({ hp: 1000, armor: 100, mr: 0 }))
    expect(result.physical).toBeCloseTo(2000)
    expect(result.magic).toBeCloseTo(1000)
  })
})
