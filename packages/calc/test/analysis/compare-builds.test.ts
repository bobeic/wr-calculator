// packages/calc/test/analysis/compare-builds.test.ts
import { describe, it, expect } from 'vitest'
import { compareBuilds } from '../../src/analysis/compare-builds'
import type { CompareBuildsScenario } from '../../src/analysis/compare-builds'
import { combatantFromDummy } from '../../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

function championWithAbility(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: { id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
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

function adItem(id: string, ad: number, cost: number): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: cost, combine: cost }, recipe: [],
    stats: { ad }, effects: [], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

describe('compareBuilds', () => {
  it('produces one breakpoint per item, with cumulative gold, rising dps, and no ttk against a dummy', () => {
    const items = new Map([
      ['item-a1', adItem('item-a1', 10, 1000)],
      ['item-a2', adItem('item-a2', 20, 2000)],
    ])
    const champion = championWithAbility()
    const buildA = emptyBuild({ items: ['item-a1', 'item-a2'] })
    const buildB = emptyBuild({ items: ['item-a1'] })
    const target = combatantFromDummy(dummy())
    const scenario: CompareBuildsScenario = { durationSeconds: 3, priority: [], burstSequence: ['AA'] }

    const result = compareBuilds(
      { champion, level: 1, build: buildA, catalog: { items, runes: new Map() } },
      { champion, level: 1, build: buildB, catalog: { items, runes: new Map() } },
      target, scenario
    )

    expect(result.a).toHaveLength(2)
    expect(result.b).toHaveLength(1)
    expect(result.a.map((bp) => bp.gold)).toEqual([1000, 3000])
    expect(result.a[0].burst).toBeCloseTo(70) // 60 base AD + 10 from item-a1
    expect(result.a[1].burst).toBeCloseTo(90) // + 20 from item-a2
    expect(result.a[1].dps).toBeGreaterThan(result.a[0].dps)
    expect(result.a[0].ttk).toBeUndefined() // single AA never kills a 100000hp dummy
    expect(result.a[0].ehp).toEqual({ physical: 1000, magic: 1000 })
  })
})
