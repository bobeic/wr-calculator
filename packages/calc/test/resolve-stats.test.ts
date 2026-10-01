import { describe, it, expect } from 'vitest'
import { resolveStats } from '../src/resolve-stats'
import type { Champion, Item, Rune, Build } from '@wr-calc/schema'
import { MAX_CHAMPION_LEVEL, ATTACK_SPEED_CAP } from '../src/rules'

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

describe('resolveStats', () => {
  it('resolves champion base stats at level 1 with no items', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.base.hp).toBe(610)
    expect(sheet.base.ad).toBe(60)
    expect(sheet.total.ad).toBe(60)
    expect(sheet.bonus.ad).toBeUndefined()
  })

  it('grows champion base stats with level', () => {
    const sheet = resolveStats(
      validChampion(), MAX_CHAMPION_LEVEL, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.base.hp).toBeGreaterThan(610)
  })

  it('adds item stats to the bonus layer and sums into total', () => {
    const items = new Map([['long-sword', itemWithStats('long-sword', 10)]])
    const build = emptyBuild({ items: ['long-sword'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(10)
    expect(sheet.total.ad).toBe(70)
  })

  it('throws when a build references an unknown item id', () => {
    const build = emptyBuild({ items: ['does-not-exist'] })
    expect(() => resolveStats(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown item id/)
  })

  it('throws when a build holds two items from the same exclusiveGroup', () => {
    const first = { ...itemWithStats('pen-a', 0), exclusiveGroup: 'percent-magic-pen' }
    const second = { ...itemWithStats('pen-b', 0), exclusiveGroup: 'percent-magic-pen' }
    const items = new Map([['pen-a', first], ['pen-b', second]])
    const build = emptyBuild({ items: ['pen-a', 'pen-b'] })
    expect(() => resolveStats(validChampion(), 1, build, { items, runes: new Map() }))
      .toThrow(/pen-a.*pen-b.*percent-magic-pen/)
  })

  it('throws when a build references an unknown rune id', () => {
    const build = emptyBuild({ runes: ['does-not-exist'] })
    expect(() => resolveStats(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown rune id/)
  })

  it('includes boots and enchant stats in the bonus layer, not just build.items', () => {
    const boots: Item = { ...itemWithStats('boots-of-swiftness', 0), tier: 'boots' }
    boots.stats = { moveSpeed: 45 }
    const enchant = itemWithStats('stasis-enchant', 0)
    enchant.stats = { ad: 15 }
    const items = new Map([
      ['boots-of-swiftness', boots],
      ['stasis-enchant', enchant],
    ])
    const build = emptyBuild({ boots: 'boots-of-swiftness', enchant: 'stasis-enchant' })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.moveSpeed).toBe(45)
    expect(sheet.bonus.ad).toBe(15)
  })

  it('throws when a build references an unknown boots id', () => {
    const build = emptyBuild({ boots: 'does-not-exist' })
    expect(() => resolveStats(
      validChampion(), 1, build, { items: new Map(), runes: new Map() }
    )).toThrow(/unknown item id/)
  })

  it('records a data warning for a null item stat', () => {
    const item = itemWithStats('rabadons', 0)
    item.stats = { ap: null }
    const items = new Map([['rabadons', item]])
    const build = emptyBuild({ items: ['rabadons'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.dataWarnings).toContain('rabadons: stats.ap is unverified (null)')
  })

  it('applies a stat effect from an item to the bonus layer', () => {
    const item = itemWithStats('passive-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'passive-item-passive', name: 'Test Passive', description: '', support: 'full',
      kind: 'stat', stat: 'armor', amount: 20,
    }]
    const items = new Map([['passive-item', item]])
    const build = emptyBuild({ items: ['passive-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.armor).toBe(20)
  })

  it('applies statMultiplier after flat contributions', () => {
    const item = itemWithStats('flat-item', 100)
    item.effects = [{
      id: 'mult', name: 'Test Multiplier', description: '', support: 'full',
      kind: 'statMultiplier', stat: 'ad', layer: 'bonus', amount: 0.1,
    }]
    const items = new Map([['flat-item', item]])
    const build = emptyBuild({ items: ['flat-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(110)
  })

  it('adds statMultipliers on the same stat together instead of compounding them', () => {
    // Measured 2026-09-26: 450 AP with Rabadon's (+30%) and Blackfire (+4%) showed 603 in game,
    // i.e. 450 x 1.34, not 450 x 1.3 x 1.04 = 608.4.
    const item = itemWithStats('ap-item', 0)
    item.stats = { ap: 450 }
    item.effects = [
      {
        id: 'mult-a', name: 'Multiplier A', description: '', support: 'full',
        kind: 'statMultiplier', stat: 'ap', layer: 'total', amount: 0.3,
      },
      {
        id: 'mult-b', name: 'Multiplier B', description: '', support: 'full',
        kind: 'statMultiplier', stat: 'ap', layer: 'total', amount: 0.04,
      },
    ]
    const items = new Map([['ap-item', item]])
    const build = emptyBuild({ items: ['ap-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.total.ap).toBeCloseTo(603, 6)
  })

  it('defers a statMultiplier gated on targetHasDot to combat, sized from the pre-multiplier stat', () => {
    const item = itemWithStats('ap-item', 0)
    item.stats = { ap: 450 }
    item.effects = [
      {
        id: 'mult-a', name: 'Multiplier A', description: '', support: 'full',
        kind: 'statMultiplier', stat: 'ap', layer: 'total', amount: 0.3,
      },
      {
        id: 'burn-mult', name: 'Burning Multiplier', description: '', support: 'full',
        kind: 'statMultiplier', stat: 'ap', layer: 'total', amount: 0.04,
        condition: { type: 'targetHasDot' },
      },
    ]
    const items = new Map([['ap-item', item]])
    const build = emptyBuild({ items: ['ap-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.total.ap).toBeCloseTo(585, 6)
    expect(sheet.combatContributions).toHaveLength(1)
    expect(sheet.combatContributions![0].effect.id).toBe('burn-mult')
    expect(sheet.combatContributions![0].contributions[0]).toMatchObject({ stat: 'ap', layer: 'bonus' })
    expect(sheet.combatContributions![0].contributions[0].amount).toBeCloseTo(18, 6)
  })

  it('applies % multipliers to stats gained from a statConversion', () => {
    const item = itemWithStats('riftmaker-like', 0)
    item.stats = { ap: 100, hp: 350 }
    item.effects = [
      {
        id: 'conv', name: 'Test Conversion', description: '', support: 'full',
        kind: 'statConversion', fromStat: 'hp', fromLayer: 'bonus', toStat: 'ap', ratio: 0.02,
      },
      {
        id: 'mult', name: 'Test Multiplier', description: '', support: 'full',
        kind: 'statMultiplier', stat: 'ap', layer: 'total', amount: 0.3,
      },
    ]
    const items = new Map([['riftmaker-like', item]])
    const build = emptyBuild({ items: ['riftmaker-like'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.total.ap).toBeCloseTo((100 + 7) * 1.3, 6)
  })

  it('applies statConversion using the flat total of the source stat', () => {
    const item = itemWithStats('conversion-item', 0)
    item.stats = { ap: 100 }
    item.effects = [{
      id: 'conv', name: 'Test Conversion', description: '', support: 'full',
      kind: 'statConversion', fromStat: 'ap', toStat: 'ad', ratio: 0.3,
    }]
    const items = new Map([['conversion-item', item]])
    const build = emptyBuild({ items: ['conversion-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(30)
  })

  it('applies a stacking effect scaled by the input stack count', () => {
    const item = itemWithStats('stacking-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'stacks', name: 'Test Stacks', description: '', support: 'full',
      kind: 'stacking', stat: 'ad', perStack: 2, maxStacks: 5, stackInputId: 'stacks',
    }]
    const items = new Map([['stacking-item', item]])
    const build = emptyBuild({ items: ['stacking-item'], inputs: { stacks: 3 } })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.bonus.ad).toBe(6)
  })

  it('applies effects from runes as well as items', () => {
    const rune: Rune = {
      id: 'conqueror', name: 'Conqueror', path: 'precision', slot: 'keystone',
      effects: [{
        id: 'conqueror-ad', name: 'Conqueror', description: '', support: 'full',
        kind: 'stat', stat: 'ad', amount: 5,
      }],
    }
    const runes = new Map([['conqueror', rune]])
    const build = emptyBuild({ runes: ['conqueror'] })
    const sheet = resolveStats(validChampion(), 1, build, { items: new Map(), runes })
    expect(sheet.bonus.ad).toBe(5)
  })

  it('reports unsupported effects that were involved in the computation', () => {
    const item = itemWithStats('partial-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'iffy', name: 'Iffy Passive', description: '', support: 'partial',
      supportNotes: 'exact scaling unconfirmed',
      kind: 'stat', stat: 'ad', amount: 5,
    }]
    const items = new Map([['partial-item', item]])
    const build = emptyBuild({ items: ['partial-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.unsupportedEffects).toEqual([
      { id: 'iffy', support: 'partial', supportNotes: 'exact scaling unconfirmed' },
    ])
  })

  it('does not report combat-only effects as unsupported since they never contribute stats', () => {
    const item = itemWithStats('onhit-item', 0)
    item.stats = {}
    item.effects = [{
      id: 'onhit', name: 'On-Hit', description: '', support: 'partial',
      kind: 'onHit', damageType: 'physical', flat: 10,
    }]
    const items = new Map([['onhit-item', item]])
    const build = emptyBuild({ items: ['onhit-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.unsupportedEffects).toEqual([])
  })

  it('caps attack speed at ATTACK_SPEED_CAP', () => {
    const item = itemWithStats('as-item', 0)
    item.stats = { attackSpeed: 10 }
    const items = new Map([['as-item', item]])
    const build = emptyBuild({ items: ['as-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.total.attackSpeed).toBe(ATTACK_SPEED_CAP)
  })

  it('combines bonus attack speed with base multiplicatively, not additively', () => {
    const item = itemWithStats('as-fraction-item', 0)
    item.stats = { attackSpeed: 0.25 }
    const items = new Map([['as-fraction-item', item]])
    const build = emptyBuild({ items: ['as-fraction-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.total.attackSpeed).toBeCloseTo(0.625 * 1.25, 10)
    expect(sheet.total.attackSpeed).not.toBeCloseTo(0.625 + 0.25, 10)
  })

  it('always reports the core unverified rules used by every call', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.unverifiedRules).toEqual(expect.arrayContaining([
      'maxChampionLevel', 'statResolutionOrder', 'attackSpeedRatioGrowth',
      'attackSpeedCap', 'attackSpeedStacking',
    ]))
  })

  it('no longer reports statGrowthCurve: it was verified in the practice tool', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.unverifiedRules).not.toContain('statGrowthCurve')
  })

  it('tags levelRangeInterpolation only when a levelRange scalar is actually used', () => {
    const item = itemWithStats('range-item', 0)
    item.stats = { ap: { levelRange: { min: 10, max: 50 } } }
    const items = new Map([['range-item', item]])
    const build = emptyBuild({ items: ['range-item'] })
    const sheet = resolveStats(validChampion(), 1, build, { items, runes: new Map() })
    expect(sheet.unverifiedRules).toContain('levelRangeInterpolation')
  })

  it('breakdown entries sum to the base/bonus totals for every stat', () => {
    const item = itemWithStats('multi-stat-item', 25)
    item.effects = [{
      id: 'mult', name: 'Test Multiplier', description: '', support: 'full',
      kind: 'statMultiplier', stat: 'ad', layer: 'bonus', amount: 0.2,
    }]
    const items = new Map([['multi-stat-item', item]])
    const build = emptyBuild({ items: ['multi-stat-item'] })
    const sheet = resolveStats(validChampion(), 5, build, { items, runes: new Map() })

    const statsInBreakdown = new Set(sheet.breakdown.map((entry) => entry.stat))
    for (const stat of statsInBreakdown) {
      const baseSum = sheet.breakdown
        .filter((entry) => entry.stat === stat && entry.layer === 'base')
        .reduce((acc, entry) => acc + entry.amount, 0)
      const bonusSum = sheet.breakdown
        .filter((entry) => entry.stat === stat && entry.layer === 'bonus')
        .reduce((acc, entry) => acc + entry.amount, 0)
      expect(sheet.base[stat] ?? 0).toBeCloseTo(baseSum, 10)
      expect(sheet.bonus[stat] ?? 0).toBeCloseTo(bonusSum, 10)
    }
  })

  it('includes a breakdown entry for every contribution with its source', () => {
    const sheet = resolveStats(
      validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const hpEntry = sheet.breakdown.find((entry) => entry.stat === 'hp')
    expect(hpEntry).toMatchObject({
      stat: 'hp', layer: 'base', amount: 610,
      source: { kind: 'champion', id: 'nunu-willump', name: 'Nunu & Willump' },
    })
  })

  it('clamps level below 1 up to 1', () => {
    const sheet = resolveStats(validChampion(), 0, emptyBuild(), { items: new Map(), runes: new Map() })
    const level1Sheet = resolveStats(validChampion(), 1, emptyBuild(), { items: new Map(), runes: new Map() })
    expect(sheet.base.hp).toBe(level1Sheet.base.hp)
  })

  it('clamps level above MAX_CHAMPION_LEVEL down to MAX_CHAMPION_LEVEL', () => {
    const sheet = resolveStats(
      validChampion(), MAX_CHAMPION_LEVEL + 50, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const maxLevelSheet = resolveStats(
      validChampion(), MAX_CHAMPION_LEVEL, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    expect(sheet.base.hp).toBe(maxLevelSheet.base.hp)
  })

  it('rounds a non-integer level', () => {
    const sheet = resolveStats(validChampion(), 7.4, emptyBuild(), { items: new Map(), runes: new Map() })
    const level7Sheet = resolveStats(validChampion(), 7, emptyBuild(), { items: new Map(), runes: new Map() })
    expect(sheet.base.hp).toBe(level7Sheet.base.hp)
  })

  it("applies a stat effect carried by the champion's own ability at that ability's rank", () => {
    const champion = validChampion()
    champion.abilities.r = {
      ...champion.abilities.r,
      effects: [{
        id: 'r-pen', name: 'Pen', description: '', support: 'full',
        kind: 'stat', stat: 'pctArmorPen', amount: { byRank: [0.1, 0.2, 0.3] },
      }],
    }
    const sheet = resolveStats(champion, 15, emptyBuild(), { items: new Map(), runes: new Map() })
    expect(sheet.total.pctArmorPen).toBeCloseTo(0.3, 10)
  })
})
