import { describe, it, expect } from 'vitest'
import { simulateCombo } from '../src/simulate-combo'
import { combatantFromChampion, combatantFromDummy } from '../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

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
  return { kind: 'dummy', hp: 1000, armor: 0, mr: 0, ...overrides }
}

function baseItem(id: string, effect: Item['effects'][number]): Item {
  return {
    id, name: id, tier: 'basic', cost: { total: 1000, combine: 1000 }, recipe: [], stats: {},
    effects: [effect], tags: [],
    provenance: { source: 'manual', patch: '0.0.0', verifiedInGame: false },
  }
}

describe('simulateCombo', () => {
  it('deals basic AD damage on each AA at the attack interval', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['AA', 'AA'], { critMode: 'never' })
    expect(result.instances.map((i) => i.time)).toEqual([1, 2])
    expect(result.instances[0].mitigated).toBe(60)
    expect(result.totalsByType.physical).toBe(120)
  })

  it('applies crit mode to AA damage', () => {
    const champion = championWithAbility({
      baseStats: {
        hp: { base: 1000, perLevel: 0 }, ad: { base: 100, perLevel: 0 },
        critChance: { base: 0.5, perLevel: 0 },
      },
    })
    const attacker = combatantFromChampion(
      champion, 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())

    const never = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    const always = simulateCombo(attacker, target, ['AA'], { critMode: 'always' })
    const expected = simulateCombo(attacker, target, ['AA'], { critMode: 'expected' })

    expect(never.instances[0].mitigated).toBe(100)
    expect(always.instances[0].mitigated).toBe(175)
    expect(expected.instances[0].mitigated).toBeCloseTo(100 * (1 + 0.5 * 0.75))
  })

  it('applies an onHit item effect on every basic attack', () => {
    const item = baseItem('test-onhit', {
      id: 'test-onhit-passive', name: 'Test On-Hit Passive', description: '', support: 'full',
      kind: 'onHit', damageType: 'magic', flat: 20,
    })
    const items = new Map([['test-onhit', item]])
    const build = emptyBuild({ items: ['test-onhit'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    expect(result.instances).toHaveLength(2)
    expect(result.totalsByType.physical).toBe(60)
    expect(result.totalsByType.magic).toBe(20)
  })

  it('reduces damage against an armored target', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const noArmor = combatantFromDummy(dummy({ armor: 0 }))
    const armored = combatantFromDummy(dummy({ armor: 100 }))
    const damageAgainst = (t: ReturnType<typeof combatantFromDummy>) =>
      simulateCombo(attacker, t, ['AA'], { critMode: 'never' }).instances[0].mitigated
    expect(damageAgainst(armored)).toBeCloseTo(damageAgainst(noArmor) * 0.5)
  })

  it('casts an ability, deals its damage, and respects its cooldown', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['Q', 'Q'], { critMode: 'never' })
    expect(result.instances).toHaveLength(1)
    expect(result.instances[0].mitigated).toBe(50)
  })

  it('ignores cooldowns when the option is set', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(
      attacker, target, ['Q', 'Q'], { critMode: 'never', ignoreCooldowns: true }
    )
    expect(result.instances).toHaveLength(2)
  })

  it('computes pctTargetCurrentHp against live target hp, shrinking across successive attacks', () => {
    const item = baseItem('test-pct-item', {
      id: 'test-pct-passive', name: 'Test Pct Passive', description: '', support: 'full',
      kind: 'onHit', damageType: 'true', pctTargetCurrentHp: 0.5,
    })
    const items = new Map([['test-pct-item', item]])
    const build = emptyBuild({ items: ['test-pct-item'] })
    const champion = championWithAbility({
      baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 0, perLevel: 0 } },
    })
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy({ hp: 1000 }))
    const result = simulateCombo(attacker, target, ['AA', 'AA'], { critMode: 'never' })
    const onHitInstances = result.instances.filter((i) => i.type === 'true')
    expect(onHitInstances[0].mitigated).toBe(500)
    expect(onHitInstances[1].mitigated).toBe(250)
  })

  it('detects a kill, records timeToKill and overkill, and stops processing further actions', () => {
    const champion = championWithAbility({
      baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 500, perLevel: 0 } },
    })
    const attacker = combatantFromChampion(
      champion, 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy({ hp: 300, armor: 0 }))
    const result = simulateCombo(attacker, target, ['AA', 'AA', 'AA'], { critMode: 'never' })
    expect(result.killed).toBe(true)
    expect(result.timeToKill).toBe(1)
    expect(result.overkill).toBe(200)
    expect(result.instances).toHaveLength(1)
  })

  it('aggregates unsupportedEffects and dataWarnings from resolveStats and its own combat dispatch', () => {
    const partialItem = baseItem('test-partial-item', {
      id: 'test-partial-passive', name: 'Test Partial Passive', description: '',
      support: 'partial', supportNotes: 'exact scaling unconfirmed',
      kind: 'onHit', damageType: 'physical', flat: 5,
    })
    const items = new Map([['test-partial-item', partialItem]])
    const build = emptyBuild({ items: ['test-partial-item'] })
    const champion = championWithAbility()
    champion.abilities.q.damage = [{ type: 'magic', base: null, ratios: [], tags: [] }]
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())

    const result = simulateCombo(attacker, target, ['AA', 'Q'], { critMode: 'never' })
    expect(result.unsupportedEffects).toEqual([
      { id: 'test-partial-passive', support: 'partial', supportNotes: 'exact scaling unconfirmed' },
    ])
    expect(result.dataWarnings).toContain('Q: base is unverified (null)')
  })

  it('triggers an item active on an item:<id> action and respects its cooldown', () => {
    const item = baseItem('test-active-item', {
      id: 'test-active-passive', name: 'Test Active', description: '', support: 'full',
      kind: 'active', cooldownSeconds: 60, damageType: 'magic', damage: 100,
    })
    const items = new Map([['test-active-item', item]])
    const build = emptyBuild({ items: ['test-active-item'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(
      attacker, target, ['item:test-active-item', 'item:test-active-item'], { critMode: 'never' }
    )
    expect(result.instances).toHaveLength(1)
    expect(result.instances[0].mitigated).toBe(100)
  })

  it('ticks a dot applied on ability hit while a later wait advances through it', () => {
    const item = baseItem('test-dot-item', {
      id: 'test-dot-passive', name: 'Test DoT', description: '', support: 'full',
      kind: 'dot', damageType: 'magic', tickAmount: 10, tickIntervalSeconds: 1,
      durationSeconds: 3, refresh: 'refresh',
    })
    const items = new Map([['test-dot-item', item]])
    const build = emptyBuild({ items: ['test-dot-item'] })
    const champion = championWithAbility()
    champion.abilities.q.damage = []
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['Q', 'wait:3'], { critMode: 'never' })
    const dotInstances = result.instances.filter((i) => i.source.id === 'test-dot-passive')
    expect(dotInstances).toHaveLength(3)
    expect(dotInstances.map((i) => i.mitigated)).toEqual([10, 10, 10])
  })
})
