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

  it('parses an empoweredAttack effect', () => {
    const result = EffectSchema.parse({
      ...base, kind: 'empoweredAttack',
      grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
      maxCharges: 3, durationSeconds: 4, attackSpeedBonus: 0.5,
      bonus: { type: 'physical', base: { byLevel: [5, 7.5] }, ratios: [{ stat: 'bonusAd', value: 0.25 }], tags: [] },
    })
    expect(result).toMatchObject({ kind: 'empoweredAttack', maxCharges: 3 })
  })

  it('rejects an empoweredAttack with zero charges or an unknown grant trigger', () => {
    const effect = {
      ...base, kind: 'empoweredAttack', grant: { on: 'abilityCast' }, maxCharges: 1,
      durationSeconds: 4, bonus: { type: 'physical', base: 10, ratios: [], tags: [] },
    }
    expect(() => EffectSchema.parse({ ...effect, maxCharges: 0 })).toThrow()
    expect(() => EffectSchema.parse({ ...effect, grant: { on: 'onKill' } })).toThrow()
  })
})
