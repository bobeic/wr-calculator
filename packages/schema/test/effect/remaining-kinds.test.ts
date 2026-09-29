import { describe, it, expect } from 'vitest'
import { EffectSchema } from '../../src/effect/effect'

const base = {
  id: 'test-effect',
  name: 'Test Effect',
  description: 'Test description',
  support: 'full' as const,
}

describe('remaining effect kinds', () => {
  it('parses a shield effect with stat ratios', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'shield', amount: 0, durationSeconds: 2, ratios: [{ stat: 'mana', value: 0.16 }],
    })
    expect(result).toMatchObject({ ratios: [{ stat: 'mana', value: 0.16 }] })
  })

  it('parses a shield effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'shield', amount: 300, durationSeconds: 2.5,
    })
    expect(result.kind).toBe('shield')
  })

  it('parses a heal effect', () => {
    const result = EffectSchema.parse({ ...base, kind: 'heal', amount: 150 })
    expect(result.kind).toBe('heal')
  })

  it('parses an active effect with stat ratios and extra hits', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'active', cooldownSeconds: 30, damageType: 'magic', damage: 100,
      ratios: [{ stat: 'ap', value: 0.1 }], extraHits: { count: 6, fraction: 0.1 },
    })
    expect(result).toMatchObject({ ratios: [{ stat: 'ap', value: 0.1 }], extraHits: { count: 6, fraction: 0.1 } })
    expect(() => EffectSchema.parse({
      ...base, kind: 'active', cooldownSeconds: 30, extraHits: { count: -1, fraction: 0.1 },
    })).toThrow()
  })

  it('parses an active effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'active', cooldownSeconds: 60, damageType: 'magic', damage: 200,
    })
    expect(result.kind).toBe('active')
  })

  it('parses a custom effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'custom', support: 'partial', handler: 'someHandler',
    })
    expect(result.kind).toBe('custom')
  })

  it('rejects a custom effect missing handler', () => {
    expect(() => EffectSchema.parse({ ...base, kind: 'custom' })).toThrow()
  })
})
