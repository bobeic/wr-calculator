import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('simple effect kinds', () => {
  it('parses a stat effect', () => {
    const result = EffectSchema.parse({ ...base, kind: 'stat', stat: 'ad', amount: 10 })
    expect(result.kind).toBe('stat')
  })

  it('parses a statMultiplier effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'statMultiplier', stat: 'ad', layer: 'bonus', amount: 0.1,
    })
    expect(result.kind).toBe('statMultiplier')
  })

  it('parses a statConversion effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'statConversion', fromStat: 'ap', toStat: 'ad', ratio: 0.3,
    })
    expect(result.kind).toBe('statConversion')
  })

  it('parses a stacking effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'stacking', stat: 'ad', perStack: 2, maxStacks: 5, stackInputId: 'stacks',
    })
    expect(result.kind).toBe('stacking')
  })

  it('accepts null amount on a stat effect (unverified real value)', () => {
    const result = EffectSchema.parse({ ...base, kind: 'stat', stat: 'ad', amount: null })
    expect(result.kind === 'stat' && result.amount).toBeNull()
  })

  it('rejects a stat effect missing amount', () => {
    expect(() => EffectSchema.parse({ ...base, kind: 'stat', stat: 'ad' })).toThrow()
  })

  it('rejects an unknown kind', () => {
    expect(() => EffectSchema.parse({ ...base, kind: 'madeUpKind' })).toThrow()
  })
})
