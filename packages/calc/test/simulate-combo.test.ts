import { describe, it, expect } from 'vitest'
import { simulateCombo } from '../src/simulate-combo'
import { combatantFromChampion, combatantFromDummy } from '../src/combatant'
import type { Champion, Item, Build, Target } from '@wr-calc/schema'

function championWithAbility(overrides: Partial<Champion> = {}): Champion {
  return {
    id: 'test-champ', name: 'Test Champion', resource: 'mana',
    baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 60, perLevel: 0 } },
    attackSpeed: { base: 1, ratio: 0 },
    provenance: { source: 'manual', patch: 'test', verifiedInGame: false },
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
    expect(result.instances.map((i) => i.time)).toEqual([0, 1])
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
    expect(always.instances[0].mitigated).toBe(200)
    expect(expected.instances[0].mitigated).toBeCloseTo(100 * (1 + 0.5 * 1))
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
    expect(result.timeToKill).toBe(0)
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

  it('resolves a byRank ability cooldown at the ability\'s maxRank', () => {
    const champion = championWithAbility()
    champion.abilities.q.cooldown = { byRank: [12, 11, 10, 9, 8] }
    const attacker = combatantFromChampion(
      champion, 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const blocked = simulateCombo(attacker, target, ['Q', 'wait:7.9', 'Q'], { critMode: 'never' })
    expect(blocked.instances).toHaveLength(1)
    const recast = simulateCombo(attacker, target, ['Q', 'wait:8', 'Q'], { critMode: 'never' })
    expect(recast.instances).toHaveLength(2)
    expect(recast.dataWarnings.filter((warning) => warning.includes('byRank'))).toEqual([])
  })

  it('resolves byRank ability damage at the ability\'s maxRank', () => {
    const champion = championWithAbility()
    champion.abilities.q.damage = [
      { type: 'true', base: { byRank: [50, 100, 150, 200, 250] }, ratios: [], tags: [] },
    ]
    const attacker = combatantFromChampion(
      champion, 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['Q'], { critMode: 'never' })
    expect(result.instances[0].mitigated).toBe(250)
  })

  it('blocks a hook-based effect when its condition is not met', () => {
    const item = baseItem('test-conditional-onhit', {
      id: 'test-conditional-onhit-passive', name: 'Test Conditional On-Hit', description: '',
      support: 'full', kind: 'onHit', damageType: 'magic', flat: 20,
      condition: { type: 'targetHpBelow', threshold: 0.5 },
    })
    const items = new Map([['test-conditional-onhit', item]])
    const build = emptyBuild({ items: ['test-conditional-onhit'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy({ hp: 1000 })) // starts at full hp, so targetHpBelow(0.5) is false
    const result = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    expect(result.totalsByType.magic).toBeUndefined()
  })

  it('allows a hook-based effect when its condition is met', () => {
    const item = baseItem('test-conditional-onhit', {
      id: 'test-conditional-onhit-passive', name: 'Test Conditional On-Hit', description: '',
      support: 'full', kind: 'onHit', damageType: 'magic', flat: 20,
      condition: { type: 'targetHpAbove', threshold: 0.5 },
    })
    const items = new Map([['test-conditional-onhit', item]])
    const build = emptyBuild({ items: ['test-conditional-onhit'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy({ hp: 1000 })) // starts at full hp, so targetHpAbove(0.5) is true
    const result = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    expect(result.totalsByType.magic).toBe(20)
  })

  it('gates an item active on its condition without consuming its cooldown when blocked', () => {
    const item = baseItem('test-conditional-active', {
      id: 'test-conditional-active-passive', name: 'Test Conditional Active', description: '',
      support: 'full', kind: 'active', cooldownSeconds: 60, damageType: 'magic', damage: 100,
      condition: { type: 'targetHpBelow', threshold: 0.5 },
    })
    const items = new Map([['test-conditional-active', item]])
    const build = emptyBuild({ items: ['test-conditional-active'] })
    const champion = championWithAbility({
      baseStats: { hp: { base: 1000, perLevel: 0 }, ad: { base: 600, perLevel: 0 } },
    })
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy({ hp: 1000 }))
    // The first activation is blocked (target at full hp); the AA drops it to 40%, so the second
    // one fires — which it only can if the blocked attempt never put the active on cooldown.
    const result = simulateCombo(
      attacker, target, ['item:test-conditional-active', 'AA', 'item:test-conditional-active'],
      { critMode: 'never' }
    )
    const activeInstances = result.instances.filter((i) => i.source.id === 'test-conditional-active-passive')
    expect(activeInstances.map((i) => i.time)).toEqual([1])
    expect(result.totalsByType.magic).toBe(100)
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

  it('applies a damageAmp effect only when its sourceKind condition matches', () => {
    const item = baseItem('test-amp-item', {
      id: 'test-amp-passive', name: 'Test Amp', description: '', support: 'full',
      kind: 'damageAmp', amount: 1, condition: { type: 'sourceKind', value: 'ability' },
    })
    const items = new Map([['test-amp-item', item]])
    const build = emptyBuild({ items: ['test-amp-item'] })
    const champion = championWithAbility()
    champion.abilities.q.damage = [{ type: 'magic', base: 100, ratios: [], tags: [] }]
    const attacker = combatantFromChampion(champion, 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())

    const abilityResult = simulateCombo(attacker, target, ['Q'], { critMode: 'never' })
    expect(abilityResult.instances[0].mitigated).toBe(200)

    const aaResult = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    expect(aaResult.instances[0].mitigated).toBe(60)
  })

  it('resets DoT ticks on refresh instead of stacking a second tick train', () => {
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
    const result = simulateCombo(
      attacker, target, ['Q', 'Q', 'wait:3'], { critMode: 'never', ignoreCooldowns: true }
    )
    const dotInstances = result.instances.filter((i) => i.source.id === 'test-dot-passive')
    expect(dotInstances).toHaveLength(3)
    expect(result.totalsByType.magic).toBe(30)
  })

  it('does not crash when two n:1 procEveryN effects would otherwise recurse into each other', () => {
    const itemA = baseItem('test-proc-a', {
      id: 'test-proc-a-passive', name: 'Test Proc A', description: '', support: 'full',
      kind: 'procEveryN', n: 1, damageType: 'magic', damage: 5, resetsOnMiss: false,
    })
    const itemB = baseItem('test-proc-b', {
      id: 'test-proc-b-passive', name: 'Test Proc B', description: '', support: 'full',
      kind: 'procEveryN', n: 1, damageType: 'magic', damage: 5, resetsOnMiss: false,
    })
    const items = new Map([['test-proc-a', itemA], ['test-proc-b', itemB]])
    const build = emptyBuild({ items: ['test-proc-a', 'test-proc-b'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    expect(() => simulateCombo(attacker, target, ['AA'], { critMode: 'never' })).not.toThrow()
  })

  it('does not run away when three or more procEveryN effects mutually chain', () => {
    const items = new Map(['a', 'b', 'c'].map((letter) => [
      `test-proc-${letter}`,
      baseItem(`test-proc-${letter}`, {
        id: `test-proc-${letter}-passive`, name: `Test Proc ${letter.toUpperCase()}`, description: '',
        support: 'full', kind: 'procEveryN', n: 1, damageType: 'magic', damage: 5, resetsOnMiss: false,
      }),
    ]))
    const build = emptyBuild({ items: ['test-proc-a', 'test-proc-b', 'test-proc-c'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    expect(() => simulateCombo(attacker, target, ['AA'], { critMode: 'never' })).not.toThrow()
  })

  it('surfaces a custom effect with no registered handler as unsupported', () => {
    const item = baseItem('test-custom-item', {
      id: 'test-custom-passive', name: 'Test Custom', description: '',
      support: 'none', supportNotes: 'unmodeled', kind: 'custom', handler: 'does-not-exist',
    })
    const items = new Map([['test-custom-item', item]])
    const build = emptyBuild({ items: ['test-custom-item'] })
    const attacker = combatantFromChampion(championWithAbility(), 1, build, { items, runes: new Map() })
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(attacker, target, ['AA'], { critMode: 'never' })
    expect(result.unsupportedEffects).toContainEqual({
      id: 'test-custom-passive', support: 'none', supportNotes: 'unmodeled',
    })
  })

  it('warns when scheduled ticks are still pending at the end of the sequence', () => {
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
    const result = simulateCombo(attacker, target, ['Q'], { critMode: 'never' })
    expect(result.dataWarnings.some((w) => w.includes('still pending'))).toBe(true)
  })

  it('warns and ignores an invalid wait duration instead of corrupting the timeline', () => {
    const attacker = combatantFromChampion(
      championWithAbility(), 1, emptyBuild(), { items: new Map(), runes: new Map() }
    )
    const target = combatantFromDummy(dummy())
    const result = simulateCombo(
      attacker, target, ['AA', 'wait:not-a-number' as any, 'AA'], { critMode: 'never' }
    )
    expect(result.instances.every((i) => Number.isFinite(i.time))).toBe(true)
    expect(result.dataWarnings.some((w) => w.includes('Invalid wait duration'))).toBe(true)
  })
})
