import { describe, it, expect } from 'vitest'
import { ChampionSchema } from '../src/champion'

function validAbility(id: string) {
  return { id, name: id, maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} }
}

describe('ChampionSchema', () => {
  it('parses a minimal valid champion', () => {
    const champion = {
      id: 'nunu-willump',
      name: 'Nunu & Willump',
      resource: 'mana' as const,
      baseStats: { hp: { base: 610, perLevel: 90 }, ad: { base: 60, perLevel: 3 } },
      attackSpeed: { base: 0.625 },
      abilities: {
        passive: validAbility('passive'),
        q: validAbility('q'),
        w: validAbility('w'),
        e: validAbility('e'),
        r: validAbility('r'),
      },
    }
    const result = ChampionSchema.parse(champion)
    expect(result.id).toBe('nunu-willump')
  })

  it('rejects an unknown resource type', () => {
    const champion = {
      id: 'x', name: 'X', resource: 'rage', baseStats: {}, attackSpeed: { base: 0.6 },
      abilities: {
        passive: validAbility('passive'), q: validAbility('q'), w: validAbility('w'),
        e: validAbility('e'), r: validAbility('r'),
      },
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })

  it('rejects an unknown stat key in baseStats', () => {
    const champion = {
      id: 'x', name: 'X', resource: 'mana' as const,
      baseStats: { madeUpStat: { base: 10, perLevel: 1 } },
      attackSpeed: { base: 0.6 },
      abilities: {
        passive: validAbility('passive'), q: validAbility('q'), w: validAbility('w'),
        e: validAbility('e'), r: validAbility('r'),
      },
    }
    expect(() => ChampionSchema.parse(champion)).toThrow()
  })
})
