import { describe, it, expect } from 'vitest'
import { AbilitySchema, DamageComponentSchema } from '../src/ability'

describe('DamageComponentSchema', () => {
  it('parses a component with multiple ratios', () => {
    const result = DamageComponentSchema.parse({
      type: 'magic',
      base: { byRank: [80, 120, 160, 200, 240] },
      ratios: [
        { stat: 'ap', value: 0.6 },
        { stat: 'targetCurrentHp', value: 0.1 },
      ],
      tags: ['nuke'],
    })
    expect(result.ratios).toHaveLength(2)
  })

  it('rejects an unknown ratio stat', () => {
    expect(() =>
      DamageComponentSchema.parse({
        type: 'magic', base: 100, ratios: [{ stat: 'madeUp', value: 1 }], tags: [],
      })
    ).toThrow()
  })
})

describe('AbilitySchema', () => {
  const validAbility = {
    id: 'q', name: 'Test Q', maxRank: 5, cooldown: { byRank: [8, 7, 6, 5, 4] },
    castTime: 0.25, damage: [], flags: {},
  }

  it('parses a minimal valid ability', () => {
    const result = AbilitySchema.parse(validAbility)
    expect(result.id).toBe('q')
  })

  it('accepts a custom handler id for kits that do not fit', () => {
    const result = AbilitySchema.parse({ ...validAbility, custom: 'nunuSnowball' })
    expect(result.custom).toBe('nunuSnowball')
  })

  it('rejects an unknown field', () => {
    expect(() => AbilitySchema.parse({ ...validAbility, madeUpField: true })).toThrow()
  })

  it('rejects an unknown field in flags', () => {
    expect(() =>
      AbilitySchema.parse({ ...validAbility, flags: { madeUpFlag: true } })
    ).toThrow()
  })

  describe('kit mechanics fields', () => {
    const minimal = {
      id: 'q', name: 'Q', maxRank: 4, cooldown: 9, castTime: 0, damage: [], flags: {},
    }

    it('accepts a ratio whose coefficient grows with a second stat', () => {
      const result = DamageComponentSchema.parse({
        type: 'physical', base: 120, tags: [],
        ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: 0.0004 } }],
      })
      expect(result.ratios[0].perStat).toEqual({ stat: 'bonusAd', value: 0.0004 })
    })

    it('rejects an unknown field inside perStat', () => {
      expect(() => DamageComponentSchema.parse({
        type: 'physical', base: 0, tags: [],
        ratios: [{ stat: 'targetMaxHp', value: 0.07, perStat: { stat: 'bonusAd', value: 0.0004, extra: 1 } }],
      })).toThrow()
    })

    it('accepts ability-owned effects, recast stages and a cooldown start mode', () => {
      const result = AbilitySchema.parse({
        ...minimal,
        effects: [{
          id: 'r-pen', name: 'Pen', description: '', support: 'full',
          kind: 'stat', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
        }],
        stages: [{
          id: 'q2', name: 'Q2', trigger: 'press', windowSeconds: 3.5,
          damage: [{ type: 'physical', base: 70, ratios: [], tags: [] }],
        }],
        cooldownStartsOn: 'lastStage',
      })
      expect(result.effects).toHaveLength(1)
      expect(result.stages?.[0].trigger).toBe('press')
      expect(result.cooldownStartsOn).toBe('lastStage')
    })

    it('rejects a stage with an unknown trigger or a non-positive window', () => {
      const stage = { id: 'q2', name: 'Q2', trigger: 'press', windowSeconds: 3.5, damage: [] }
      expect(() => AbilitySchema.parse({ ...minimal, stages: [{ ...stage, trigger: 'hold' }] })).toThrow()
      expect(() => AbilitySchema.parse({ ...minimal, stages: [{ ...stage, windowSeconds: 0 }] })).toThrow()
    })
  })
})
