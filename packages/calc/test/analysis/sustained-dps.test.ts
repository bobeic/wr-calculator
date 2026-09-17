// packages/calc/test/analysis/sustained-dps.test.ts
import { describe, it, expect } from 'vitest'
import { sustainedDps } from '../../src/analysis/sustained-dps'
import { combatantFromChampion, combatantFromDummy } from '../../src/combatant'
import type { Champion, Build, Target } from '@wr-calc/schema'

function championWithAbility(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: {
        id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0, flags: {},
        damage: [{ type: 'magic', base: 50, ratios: [], tags: [] }],
      },
      w: { id: 'w', name: 'W', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      e: { id: 'e', name: 'E', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      r: { id: 'r', name: 'R', maxRank: 3, cooldown: 100, castTime: 0, damage: [], flags: {} },
    },
    ...overrides,
  }
}

function emptyBuild(overrides: Partial<Build> = {}): Build {
  return { items: [], runes: [], inputs: {}, ...overrides }
}

function dummy(overrides: Partial<Extract<Target, { kind: 'dummy' }>> = {}):
  Extract<Target, { kind: 'dummy' }> {
  return { kind: 'dummy', hp: 100000, armor: 0, mr: 0, ...overrides }
}

describe('sustainedDps', () => {
  it('matches AD-per-interval exactly for a pure-AA rotation', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    // attackSpeed 1 -> one AA/sec; critMode 'expected' at 0 crit chance -> exactly AD per hit.
    // Landings at t=0,1,2 fall inside [0,3); dividing by the same 3s gives back AD exactly.
    expect(sustainedDps(attacker, target, 3, [])).toBeCloseTo(60, 5)
  })

  it('adds exactly the priority ability\'s share of damage within the window', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const pureAa = sustainedDps(attacker, target, 8, [])
    const withQ = sustainedDps(attacker, target, 8, ['q'])
    // Q has an 8s cooldown and 50 magic damage; over an 8s window (t < 8) only the t=0 cast
    // counts (the recast at t=8 falls on the excluded boundary), adding exactly 50/8 dps.
    expect(withQ).toBeCloseTo(pureAa + 50 / 8, 5)
  })
})
