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
})
