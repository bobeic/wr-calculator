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

  it('divides by the achieved kill time when the target dies inside the window', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy({ hp: 120 }))
    // attackSpeed 1 and 0 armor -> exactly 60 mitigated per AA, landing at t=0 and t=1. The second
    // hit takes the 120hp dummy to exactly 0, so simulateCombo sets killed/timeToKill=1 and stops.
    // Both instances are inside the 10s window, so total=120 over an achieved window of 1s = 120 —
    // not 120/10=12, which is what dividing by the full (never-reached) window would report.
    expect(sustainedDps(attacker, target, 10, [])).toBeCloseTo(120, 5)
  })

  it('caps the divisor at the window when the padded sequence kills after `seconds`', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy({ hp: 200 }))
    // sustainedDps over-provisions the sequence on purpose: blocks = ceil(2.5/1) + 0 + 1 = 4 AAs,
    // landing at t=0,1,2,3 — so the rotation runs a full second past the 2.5s window. At 60 per AA
    // the 200hp dummy is on 20hp after t=2 and only dies on the t=3 swing, giving timeToKill=3,
    // which is outside the window. The numerator already stops at the window (t=0,1,2 -> 180), so
    // the divisor must be the 2.5s window, not the 3s kill: 180/2.5 = 72, not 180/3 = 60.
    expect(sustainedDps(attacker, target, 2.5, [])).toBeCloseTo(72, 5)
  })

  it('throws on a non-positive window instead of returning NaN or Infinity', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    expect(() => sustainedDps(attacker, target, 0, [])).toThrow(RangeError)
    expect(() => sustainedDps(attacker, target, -1, [])).toThrow(/seconds must be > 0/)
    expect(() => sustainedDps(attacker, target, Number.NaN, [])).toThrow(RangeError)
  })
})
