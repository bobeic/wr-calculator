import { describe, it, expect } from 'vitest'
import { compareBuilds } from '../../src/analysis/compare-builds'
import type { CompareBuildsScenario } from '../../src/analysis/compare-builds'
import { combatantFromDummy } from '../../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

function championWithAbility(): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: { id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      w: { id: 'w', name: 'W', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      e: { id: 'e', name: 'E', maxRank: 5, cooldown: 8, castTime: 0, damage: [], flags: {} },
      r: { id: 'r', name: 'R', maxRank: 3, cooldown: 100, castTime: 0, damage: [], flags: {} },
    },
  }
}

function dummy(): Extract<Target, { kind: 'dummy' }> {
  return { kind: 'dummy', hp: 100000, armor: 0, mr: 0 }
}

function adItem(id: string, ad: number, cost: number): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: cost, combine: cost }, recipe: [],
    stats: { ad }, effects: [], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

describe('compareBuilds performance', () => {
  it('computes two 6-item builds in under 5ms', () => {
    const items = new Map<string, Item>()
    const buildAItems: string[] = []
    const buildBItems: string[] = []
    for (let i = 1; i <= 6; i++) {
      items.set(`item-a${i}`, adItem(`item-a${i}`, 10 * i, 1000 * i))
      items.set(`item-b${i}`, adItem(`item-b${i}`, 5 * i, 800 * i))
      buildAItems.push(`item-a${i}`)
      buildBItems.push(`item-b${i}`)
    }
    const champion = championWithAbility()
    const buildA: Build = { items: buildAItems, runes: [], inputs: {} }
    const buildB: Build = { items: buildBItems, runes: [], inputs: {} }
    const target = combatantFromDummy(dummy())
    const scenario: CompareBuildsScenario = { durationSeconds: 3, priority: [], burstSequence: ['AA', 'AA'] }

    // Warm-up call: excludes one-time JIT/module-evaluation cost from the measurement below,
    // which has nothing to do with compareBuilds's actual algorithmic complexity.
    let result = compareBuilds(
      { champion, level: 1, build: buildA, catalog: { items, runes: new Map() } },
      { champion, level: 1, build: buildB, catalog: { items, runes: new Map() } },
      target, scenario
    )

    // The median of several runs, so a GC pause or a busy parallel test worker can't fail one sample.
    const timings: number[] = []
    for (let run = 0; run < 21; run++) {
      const start = performance.now()
      result = compareBuilds(
        { champion, level: 1, build: buildA, catalog: { items, runes: new Map() } },
        { champion, level: 1, build: buildB, catalog: { items, runes: new Map() } },
        target, scenario
      )
      timings.push(performance.now() - start)
    }
    const median = [...timings].sort((x, y) => x - y)[Math.floor(timings.length / 2)]

    expect(result.a).toHaveLength(6)
    expect(result.b).toHaveLength(6)
    expect(median).toBeLessThan(5)
  })
})
