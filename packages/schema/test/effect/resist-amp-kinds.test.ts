import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('resist/amp effect kinds', () => {
  it('parses a stacking resistShred effect', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'resistShred',
      resist: 'armor',
      mode: 'percent',
      amount: 0.06,
      stacking: true,
      maxStacks: 5,
      durationSeconds: 3,
    })
    expect(result.kind).toBe('resistShred')
  })

  it('parses a penetration effect with its required condition', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'penetration',
      resist: 'mr',
      mode: 'flat',
      amount: 10,
      condition: { type: 'targetHpAbove', threshold: 0.5 },
    })
    expect(result.kind).toBe('penetration')
  })

  it('rejects a penetration effect with no condition', () => {
    expect(() =>
      EffectSchema.parse({ ...base, kind: 'penetration', resist: 'mr', mode: 'flat', amount: 10 })
    ).toThrow()
  })

  it('parses a damageAmp effect with its required condition', () => {
    const result = EffectSchema.parse({
      ...base,
      kind: 'damageAmp',
      amount: 0.1,
      condition: { type: 'targetHpBelow', threshold: 0.3 },
    })
    expect(result.kind).toBe('damageAmp')
  })

  it('parses a damageReduction effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'damageReduction', damageType: 'physical', amount: 0.15,
    })
    expect(result.kind).toBe('damageReduction')
  })

  it('parses a cooldownRefund effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'cooldownRefund', mode: 'percent', amount: 0.05,
    })
    expect(result.kind === 'cooldownRefund' && result.excludesUltimate).toBe(true)
  })
})
