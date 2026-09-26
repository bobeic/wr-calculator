import { describe, it, expect } from 'vitest'
import { combatantFromChampion, combatantFromDummy } from '../src/combatant'
import type { Champion, Item, Rune, Build, Target } from '@wr-calc/schema'

function validChampion(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'nunu-willump', name: 'Nunu & Willump', resource: 'mana',
    baseStats: { hp: { base: 610, perLevel: 90 }, ad: { base: 60, perLevel: 3 } },
    attackSpeed: { base: 0.625, ratio: 0.025 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
    abilities: {
      passive: { id: 'passive', name: 'P', maxRank: 1, cooldown: 0, castTime: 0, damage: [], flags: {} },
      q: { id: 'q', name: 'Q', maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} },
      w: { id: 'w', name: 'W', maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} },
      e: { id: 'e', name: 'E', maxRank: 5, cooldown: 8, castTime: 0.25, damage: [], flags: {} },
      r: { id: 'r', name: 'R', maxRank: 3, cooldown: 100, castTime: 0.25, damage: [], flags: {} },
    },
    ...overrides,
  }
}

function itemWithStats(id: string, ad: number): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: 350, combine: 350 }, recipe: [],
    stats: { ad }, effects: [], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

function emptyBuild(overrides: Partial<Build> = {}): Build {
  return { items: [], runes: [], inputs: {}, ...overrides }
}

describe('combatantFromChampion', () => {
  it('resolves the sheet and passes through champion identity and abilities', () => {
    const combatant = combatantFromChampion(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(combatant.id).toBe('nunu-willump')
    expect(combatant.kind).toBe('champion')
    expect(combatant.level).toBe(1)
    expect(combatant.sheet.total.ad).toBe(60)
    expect(combatant.abilities?.q.id).toBe('q')
  })

  it('collects build.items plus boots and enchant, in that order', () => {
    const items = new Map([
      ['long-sword', itemWithStats('long-sword', 10)],
      ['boots', itemWithStats('boots', 0)],
      ['enchant', itemWithStats('enchant', 0)],
    ])
    const build = emptyBuild({ items: ['long-sword'], boots: 'boots', enchant: 'enchant' })
    const combatant = combatantFromChampion(validChampion(), 1, build, { items, runes: new Map() })
    expect(combatant.items.map((i) => i.id)).toEqual(['long-sword', 'boots', 'enchant'])
  })

  it('flattens rune effects', () => {
    const rune: Rune = {
      id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone',
      effects: [{
        id: 'conqueror-ad', name: 'Conqueror', description: '', support: 'full',
        kind: 'stat', stat: 'ad', amount: 5,
      }],
    }
    const runes = new Map([['conqueror', rune]])
    const build = emptyBuild({ runes: ['conqueror'] })
    const combatant = combatantFromChampion(validChampion(), 1, build, { items: new Map(), runes })
    expect(combatant.runeEffects).toEqual(rune.effects)
  })

  it('propagates the unknown-item-id error from resolveStats', () => {
    const build = emptyBuild({ items: ['does-not-exist'] })
    expect(() => combatantFromChampion(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown item id/)
  })
})

describe('combatantFromDummy', () => {
  it('builds a bare-stats combatant with no abilities or items', () => {
    const dummy: Extract<Target, { kind: 'dummy' }> = { kind: 'dummy', hp: 1000, armor: 50, mr: 30 }
    const combatant = combatantFromDummy(dummy)
    expect(combatant.kind).toBe('dummy')
    expect(combatant.level).toBe(15)
    expect(combatant.sheet.total).toEqual({ hp: 1000, armor: 50, mr: 30 })
    expect(combatant.items).toEqual([])
    expect(combatant.abilities).toBeUndefined()
  })

  it('starts at full hp unless the dummy sets startHpFraction', () => {
    expect(combatantFromDummy({ kind: 'dummy', hp: 1000, armor: 0, mr: 0 }).startHpFraction).toBe(1)
    expect(
      combatantFromDummy({ kind: 'dummy', hp: 1000, armor: 0, mr: 0, startHpFraction: 0.3 }).startHpFraction
    ).toBe(0.3)
  })

  it('carries the dummy\'s own effects, if any', () => {
    const dummy: Extract<Target, { kind: 'dummy' }> = {
      kind: 'dummy', hp: 1000, armor: 0, mr: 0,
      effects: [{
        id: 'fon', name: 'Force of Nature', description: '', support: 'full',
        kind: 'damageReduction', damageType: 'magic', amount: 0.1,
      }],
    }
    expect(combatantFromDummy(dummy).runeEffects).toEqual(dummy.effects)
  })
})
