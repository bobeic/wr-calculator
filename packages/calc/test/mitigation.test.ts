import { describe, it, expect } from 'vitest'
import {
  effectiveResist, mitigationMultiplier, mitigateDamage, applyDamageReductionFractions,
} from '../src/mitigation'

describe('mitigationMultiplier', () => {
  it('is 1 at 0 resist', () => {
    expect(mitigationMultiplier(0)).toBe(1)
  })

  it('is 0.5 at 100 resist', () => {
    expect(mitigationMultiplier(100)).toBe(0.5)
  })

  it('approaches 1/3 at 200 resist', () => {
    expect(mitigationMultiplier(200)).toBeCloseTo(1 / 3)
  })

  it('amplifies damage at negative resist', () => {
    expect(mitigationMultiplier(-100)).toBe(1.5)
  })
})

describe('effectiveResist', () => {
  it('returns the raw value with no modifiers', () => {
    expect(effectiveResist(50)).toBe(50)
  })

  it('lets flat reduction drive resist negative', () => {
    expect(effectiveResist(30, {
      flatReduction: 50, pctReduction: 0, pctPen: 0, flatPen: 0,
    })).toBe(-20)
  })

  it('applies percent reduction to the running value', () => {
    expect(effectiveResist(100, {
      flatReduction: 0, pctReduction: 0.5, pctPen: 0, flatPen: 0,
    })).toBe(50)
  })

  it('clamps percent penetration at 0', () => {
    expect(effectiveResist(10, {
      flatReduction: 0, pctReduction: 0, pctPen: 2, flatPen: 0,
    })).toBe(0)
  })

  it('clamps flat penetration at 0', () => {
    expect(effectiveResist(10, {
      flatReduction: 0, pctReduction: 0, pctPen: 0, flatPen: 50,
    })).toBe(0)
  })

  it('applies all four steps in RESIST_MODIFICATION_ORDER', () => {
    // 100 -> flatReduction 20 -> 80 -> pctReduction 0 -> 80 -> pctPen 0.5 -> 40 -> flatPen 0 -> 40
    expect(effectiveResist(100, {
      flatReduction: 20, pctReduction: 0, pctPen: 0.5, flatPen: 0,
    })).toBe(40)
  })
})

describe('mitigateDamage', () => {
  it('passes true damage through unaffected by resist', () => {
    expect(mitigateDamage(100, 'true', 500)).toBe(100)
  })

  it('mitigates physical damage using the resist formula', () => {
    expect(mitigateDamage(100, 'physical', 100)).toBe(50)
  })

  it('applies resist modifiers before mitigating', () => {
    const modifiers = { flatReduction: 0, pctReduction: 0, pctPen: 0, flatPen: 100 }
    expect(mitigateDamage(100, 'magic', 100, modifiers)).toBe(100)
  })
})

describe('applyDamageReductionFractions', () => {
  it('returns the amount unchanged with no fractions', () => {
    expect(applyDamageReductionFractions(100, [])).toBe(100)
  })

  it('stacks fractions multiplicatively', () => {
    expect(applyDamageReductionFractions(100, [0.5, 0.5])).toBe(25)
  })
})
