import { describe, it, expect } from 'vitest'
import type {
  AbilityHitProcEffect, AdaptiveStatEffect, AttackStackEffect, CastBuffEffect, CombatAuraEffect, DamageAmpEffect,
  ExecuteEffect, ProcEveryNEffect,
} from '@wr-calc/schema'
import { abilityHitProcHandler } from '../../src/effects/ability-hit-proc'
import { adaptiveStatHandler } from '../../src/effects/adaptive-stat'
import { attackStackHandler } from '../../src/effects/attack-stack'
import { castBuffHandler } from '../../src/effects/cast-buff'
import { combatAuraHandler } from '../../src/effects/combat-aura'
import { damageAmpHandler } from '../../src/effects/damage-amp'
import { executeHandler } from '../../src/effects/execute'
import { procEveryNHandler } from '../../src/effects/proc-every-n'
import type { CombatantRuntime, DamageInstance, HitInfo, HookContext, RawDamageInstanceInput } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}
function sheet(total: StatSheet['total'] = {}, bonus: StatSheet['bonus'] = {}, base: StatSheet['base'] = {}): StatSheet {
  return { base, bonus, total, breakdown: [], unsupportedEffects: [], dataWarnings: [], unverifiedRules: [] }
}
function ctx(dealt: RawDamageInstanceInput[], overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 15, self: runtime(), opponent: runtime(), selfSheet: sheet(), opponentSheet: sheet({ hp: 1000 }),
    selfKind: 'champion', opponentKind: 'champion', inputs: {}, ignoreCooldowns: false,
    dealDamage: (input) => {
      dealt.push(input)
      return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
    },
    resolveComponent: (component) => ({ type: component.type, amount: 50, dataWarnings: [] }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}
const base = { description: '', support: 'full' as const }
const statCtx = { level: 15, sheet: sheet() }
const attack = (id: number): HitInfo => ({ id, kind: 'basicAttack', empowered: false })
const instance = (id: string): DamageInstance => ({
  time: 0, source: { kind: 'basicAttack', id, name: id }, type: 'physical', raw: 1, mitigated: 1, targetHpAfter: 0,
})

describe('attackStackHandler', () => {
  const dancer: AttackStackEffect = {
    ...base, id: 'pd', name: 'PD', kind: 'attackStack', stat: 'attackSpeed', amountPerStack: 0.06, maxStacks: 5,
    durationSeconds: 6,
  }

  it('adds a stack per attack up to the max and grants the stat while it lasts', () => {
    const self = runtime()
    for (let i = 1; i <= 7; i++) attackStackHandler.hooks!.onHitLanded!(dancer, ctx([], { self, time: i }), attack(i))
    expect(attackStackHandler.combatStats!(dancer, self, 7, statCtx)).toEqual([{ stat: 'attackSpeed', amount: 0.3 }])
    expect(attackStackHandler.combatStats!(dancer, self, 14, statCtx)).toEqual([])
  })

  it('counts only every second attack from the second for an alternating effect', () => {
    const dark: AttackStackEffect = { ...dancer, id: 'dark', stat: 'pctArmorPen', amountPerStack: 0.1, maxStacks: 3, every: 2, startAt: 2 }
    const self = runtime()
    attackStackHandler.hooks!.onHitLanded!(dark, ctx([], { self }), attack(1))
    expect(attackStackHandler.combatStats!(dark, self, 0, statCtx)).toEqual([])
    attackStackHandler.hooks!.onHitLanded!(dark, ctx([], { self }), attack(2))
    attackStackHandler.hooks!.onHitLanded!(dark, ctx([], { self }), attack(3))
    expect(attackStackHandler.combatStats!(dark, self, 0, statCtx)).toEqual([{ stat: 'pctArmorPen', amount: 0.1 }])
  })

  it('stacks from abilities and grants adaptive AD or AP by level (Conqueror)', () => {
    const conqueror: AttackStackEffect = {
      ...dancer, id: 'conq', stat: undefined, amountPerStack: undefined, maxStacks: 6, stacksFrom: ['basicAttack', 'ability'],
      adaptive: { ad: { levelRange: { min: 3, max: 5 } }, ap: { levelRange: { min: 5, max: 8.33 } } },
    }
    const self = runtime()
    attackStackHandler.hooks!.onHitLanded!(conqueror, ctx([], { self }), attack(1))
    attackStackHandler.hooks!.onHitLanded!(conqueror, ctx([], { self }), { id: 2, kind: 'ability', empowered: false, abilityKey: 'q' })
    expect(attackStackHandler.combatStats!(conqueror, self, 0, { level: 15, sheet: sheet({}, { ad: 40 }) })).toEqual([{ stat: 'ad', amount: 10 }])
    expect(attackStackHandler.combatStats!(conqueror, self, 0, { level: 1, sheet: sheet({ ap: 100 }) })).toEqual([{ stat: 'ap', amount: 10 }])
  })

  it('does not regain a cooldown buff until the cooldown ends', () => {
    const flurry: AttackStackEffect = { ...dancer, id: 'flurry', amountPerStack: 0.35, maxStacks: 1, cooldownSeconds: 25 }
    const self = runtime()
    attackStackHandler.hooks!.onHitLanded!(flurry, ctx([], { self, time: 0 }), attack(1))
    attackStackHandler.hooks!.onHitLanded!(flurry, ctx([], { self, time: 7 }), attack(2))
    expect(attackStackHandler.combatStats!(flurry, self, 7, statCtx)).toEqual([])
    attackStackHandler.hooks!.onHitLanded!(flurry, ctx([], { self, time: 25 }), attack(3))
    expect(attackStackHandler.combatStats!(flurry, self, 25, statCtx)).toEqual([{ stat: 'attackSpeed', amount: 0.35 }])
  })
})

describe('castBuffHandler', () => {
  const overdrive: CastBuffEffect = {
    ...base, id: 'od', name: 'OD', kind: 'castBuff', slots: ['r'], stat: 'attackSpeed', amount: 0.4,
    durationSeconds: 8, cooldownSeconds: 30,
  }

  it('grants the stat after casting a listed slot, for its duration', () => {
    const self = runtime()
    castBuffHandler.hooks!.onAbilityCast!(overdrive, ctx([], { self, time: 1 }), 'q')
    expect(castBuffHandler.combatStats!(overdrive, self, 1, statCtx)).toEqual([])
    castBuffHandler.hooks!.onAbilityCast!(overdrive, ctx([], { self, time: 1 }), 'r')
    expect(castBuffHandler.combatStats!(overdrive, self, 9, statCtx)).toEqual([{ stat: 'attackSpeed', amount: 0.4 }])
    expect(castBuffHandler.combatStats!(overdrive, self, 9.1, statCtx)).toEqual([])
  })

  it('ends a charged buff after its attacks', () => {
    const barrage = { ...overdrive, charges: 2 }
    const self = runtime()
    castBuffHandler.hooks!.onAbilityCast!(barrage, ctx([], { self }), 'r')
    castBuffHandler.hooks!.onHitLanded!(barrage, ctx([], { self }), attack(1))
    expect(castBuffHandler.combatStats!(barrage, self, 0, statCtx)).toHaveLength(1)
    castBuffHandler.hooks!.onHitLanded!(barrage, ctx([], { self }), attack(2))
    expect(castBuffHandler.combatStats!(barrage, self, 0, statCtx)).toEqual([])
  })
})

describe('castBuffHandler with a scalar amount', () => {
  it('reads a by-level amount at the owner level', () => {
    const buff = {
      kind: 'castBuff' as const, id: 'scaled', name: 'Scaled', description: '', support: 'full' as const,
      slots: ['r' as const], stat: 'attackSpeed' as const, amount: { byLevel: [0.1, 0.2] }, durationSeconds: 5, cooldownSeconds: 0,
    }
    const self = { currentHp: 1, shieldHp: 0, cooldowns: {}, buffs: { 'castBuff:scaled': { expiresAt: 5 } } }
    expect(castBuffHandler.combatStats!(buff, self, 1, { level: 2, sheet: sheet() })).toEqual([{ stat: 'attackSpeed', amount: 0.2 }])
  })
})

describe('combatAuraHandler', () => {
  const immolate: CombatAuraEffect = {
    ...base, id: 'sun', name: 'Sun', kind: 'combatAura', tickIntervalSeconds: 1, combatWindowSeconds: 3,
    damage: { type: 'magic', base: 20, ratios: [], tags: [] },
  }

  it('starts ticking one interval after the first damage and stops once combat lapses', () => {
    const dealt: RawDamageInstanceInput[] = []
    const events: { time: number; run: (c: HookContext) => void }[] = []
    const self = runtime()
    const make = (time: number): HookContext => ctx(dealt, {
      self, time, scheduleEvent: (at, run, _key, options) => {
        expect(options?.quiet).toBe(true)
        events.push({ time: at, run })
      },
    })
    combatAuraHandler.hooks!.onDamageDealt!(immolate, make(0), instance('AA'))
    expect(events.map((event) => event.time)).toEqual([1])
    while (events.length > 0) {
      const event = events.shift()!
      event.run(make(event.time))
    }
    // Ticks at 1, 2 and 3; the tick due at 4 finds combat over (4 - 0 > 3).
    expect(dealt.map((input) => input.amount)).toEqual([50, 50, 50])
  })
})

describe('executeHandler', () => {
  const collector: ExecuteEffect = { ...base, id: 'col', name: 'Col', kind: 'execute', thresholdFraction: 0.05 }

  it('kills a target left below the threshold, and only then', () => {
    const dealt: RawDamageInstanceInput[] = []
    executeHandler.hooks!.onDamageDealt!(collector, ctx(dealt, { opponent: runtime({ currentHp: 60 }) }), instance('AA'))
    expect(dealt).toEqual([])
    executeHandler.hooks!.onDamageDealt!(collector, ctx(dealt, { opponent: runtime({ currentHp: 40 }) }), instance('AA'))
    expect(dealt).toEqual([{ type: 'true', amount: 40, source: { kind: 'item', id: 'col', name: 'Col' } }])
  })
})

describe('adaptiveStatHandler', () => {
  const balance: AdaptiveStatEffect = { ...base, id: 'bal', name: 'Bal', kind: 'adaptiveStat', ad: 12, ap: 20 }
  const statCtx = (ad: number, ap: number) => ({
    level: 15, inputs: {}, statSoFar: (stat: string) => (stat === 'ad' ? ad : stat === 'ap' ? ap : 0),
  })

  it('gives AD when bonus AD is at least AP, otherwise AP', () => {
    expect(adaptiveStatHandler.contributeStats!(balance, statCtx(40, 40))[0]).toMatchObject({ stat: 'ad', amount: 12 })
    expect(adaptiveStatHandler.contributeStats!(balance, statCtx(0, 40))[0]).toMatchObject({ stat: 'ap', amount: 20 })
  })
})

describe('procEveryNHandler counting basic attacks', () => {
  const kraken: ProcEveryNEffect = {
    ...base, id: 'kraken', name: 'Kraken', kind: 'procEveryN', n: 3, damageType: 'physical', damage: 150,
    resetsOnMiss: false, countsFrom: 'basicAttack', targetMissingHpAmp: { perMissingPct: 0.0075, max: 0.75 },
  }

  it('merges the proc into every third attack, amplified by the target\'s missing Health', () => {
    const self = runtime()
    const opponent = runtime({ currentHp: 600 })
    const results = [1, 2, 3].map(() => procEveryNHandler.hooks!.beforeBasicAttack!(kraken, ctx([], { self, opponent })))
    expect(results.slice(0, 2)).toEqual([undefined, undefined])
    // 40% missing: 150 x (1 + 0.3).
    expect(results[2]?.bonus?.[0].amount).toBeCloseTo(195)
  })

  it('procs on the first attack when the start-ready input is on, then counts from zero', () => {
    const energized = { ...kraken, targetMissingHpAmp: undefined, startReadyInputId: 'ready' }
    const self = runtime()
    const make = () => ctx([], { self, inputs: { ready: true } })
    const results = [1, 2, 3, 4].map(() => procEveryNHandler.hooks!.beforeBasicAttack!(energized, make()))
    expect(results.map((result) => result !== undefined)).toEqual([true, false, false, true])
  })

  it('ignores damage instances when counting attacks', () => {
    const dealt: RawDamageInstanceInput[] = []
    procEveryNHandler.hooks!.onDamageDealt!(kraken, ctx(dealt), instance('AA'))
    expect(dealt).toEqual([])
  })
})

describe('abilityHitProcHandler on basic attacks', () => {
  const nightstalker: AbilityHitProcEffect = {
    ...base, id: 'dusk', name: 'Dusk', kind: 'abilityHitProc', damageType: 'physical', damage: 100, ratios: [],
    cooldownSeconds: 10, triggeredBy: ['basicAttack'],
  }

  it('procs on an attack, not on an ability, and respects its cooldown', () => {
    const dealt: RawDamageInstanceInput[] = []
    const self = runtime()
    abilityHitProcHandler.hooks!.onAbilityHit!(nightstalker, ctx(dealt, { self }), 'q', [instance('Q')])
    expect(dealt).toEqual([])
    abilityHitProcHandler.hooks!.onHitLanded!(nightstalker, ctx(dealt, { self, time: 1 }), attack(1))
    abilityHitProcHandler.hooks!.onHitLanded!(nightstalker, ctx(dealt, { self, time: 2 }), attack(2))
    expect(dealt.map((input) => input.amount)).toEqual([100])
  })

  it('procs once per combo when asked', () => {
    const dealt: RawDamageInstanceInput[] = []
    const self = runtime()
    const plate = { ...nightstalker, cooldownSeconds: 0, oncePerCombo: true }
    abilityHitProcHandler.hooks!.onHitLanded!(plate, ctx(dealt, { self, time: 1 }), attack(1))
    abilityHitProcHandler.hooks!.onHitLanded!(plate, ctx(dealt, { self, time: 30 }), attack(2))
    expect(dealt).toHaveLength(1)
  })
})

describe('damageAmpHandler scaled by target bonus Health', () => {
  const slayer: DamageAmpEffect = {
    ...base, id: 'gs', name: 'GS', kind: 'damageAmp', amount: 0.12, condition: { type: 'targetIsChampion' },
    scaleWithTargetBonusHp: { fullAt: 1200 },
  }
  const input: RawDamageInstanceInput = { type: 'physical', amount: 100, source: { kind: 'basicAttack', id: 'AA', name: 'AA' } }

  it('scales linearly up to the full amount', () => {
    expect(damageAmpHandler.damageMultiplier!(slayer, ctx([], { opponentSheet: sheet({}, { hp: 600 }) }), input)).toBeCloseTo(1.06)
    expect(damageAmpHandler.damageMultiplier!(slayer, ctx([], { opponentSheet: sheet({}, { hp: 3000 }) }), input)).toBeCloseTo(1.12)
  })
})
