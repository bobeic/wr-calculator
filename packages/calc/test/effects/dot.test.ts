import { describe, it, expect } from 'vitest'
import { dotHandler } from '../../src/effects/dot'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}

function sheet(): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [],
  }
}

function ctx(overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'champion', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const effect = {
  id: 'e1', name: 'Test DoT', description: '', support: 'full' as const,
  kind: 'dot' as const, damageType: 'magic' as const, tickAmount: 5, tickIntervalSeconds: 2,
  durationSeconds: 6, refresh: 'refresh' as const, ratios: [],
}

describe('dotHandler.onAbilityHit', () => {
  it('schedules one tick per interval within the duration', () => {
    const scheduled: number[] = []
    const c = ctx({ scheduleEvent: (atTime) => { scheduled.push(atTime) } })
    dotHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(scheduled).toEqual([2, 4, 6])
  })

  it('marks the target as affected with an expiry', () => {
    const opponent = runtime()
    const c = ctx({ opponent, scheduleEvent: () => {} })
    dotHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(opponent.buffs['dot:e1']).toEqual({ expiresAt: 6 })
  })

  it('deals tickAmount damage of damageType when a scheduled tick runs', () => {
    let dealt: { type: string; amount: number } | undefined
    const c = ctx({
      scheduleEvent: (_atTime, run) => run(ctx({
        dealDamage: (input) => {
          dealt = { type: input.type, amount: input.amount }
          return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
        },
      })),
    })
    dotHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(dealt).toEqual({ type: 'magic', amount: 5 })
  })

  it('does not reschedule when already active and refresh is "ignore"', () => {
    const ignoreEffect = { ...effect, refresh: 'ignore' as const }
    const scheduled: number[] = []
    const opponent = runtime({ buffs: { 'dot:e1': { expiresAt: 3 } } })
    const c = ctx({ opponent, scheduleEvent: (atTime) => { scheduled.push(atTime) } })
    dotHandler.hooks!.onAbilityHit!(ignoreEffect, c, 'q', [])
    expect(scheduled).toEqual([])
  })
})

describe('dotHandler tick ratios', () => {
  it('adds each ratio times the attacker\'s stat to every tick', () => {
    const apSheet = { ...sheet(), total: { ap: 600 } }
    let dealt = 0
    const c = ctx({
      selfSheet: apSheet,
      scheduleEvent: (_atTime, run) => run(ctx({
        dealDamage: (input) => {
          dealt = input.amount
          return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
        },
      })),
    })
    dotHandler.hooks!.onAbilityHit!({ ...effect, ratios: [{ stat: 'ap', value: 0.05 }] }, c, 'r', [])
    expect(dealt).toBe(35)
  })
})

describe('dotHandler target max HP ticks', () => {
  it('adds targetMaxHpRatio times the target\'s max HP to every tick', () => {
    let dealt = 0
    const c = ctx({
      opponentSheet: { ...sheet(), total: { hp: 10000 } },
      scheduleEvent: (_atTime, run) => run(ctx({
        dealDamage: (input) => {
          dealt = input.amount
          return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
        },
      })),
    })
    dotHandler.hooks!.onAbilityHit!({ ...effect, tickAmount: 0, targetMaxHpRatio: 0.01 }, c, 'q', [])
    expect(dealt).toBe(100)
  })
})

describe('dotHandler.modifyResist', () => {
  const shredding = { ...effect, shredWhileActive: { resist: 'mr' as const, amount: 10 } }

  it('reduces the matching resist by a flat amount while the dot is active, up to its expiry', () => {
    const opponent = runtime({ buffs: { 'dot:e1': { expiresAt: 6 } } })
    expect(dotHandler.modifyResist!(shredding, ctx({ opponent, time: 6 }), 'magic')).toEqual({ flatReduction: 10 })
  })

  it('does nothing once the dot has expired, before it is applied, or for other damage types', () => {
    const active = runtime({ buffs: { 'dot:e1': { expiresAt: 6 } } })
    expect(dotHandler.modifyResist!(shredding, ctx({ opponent: active, time: 6.1 }), 'magic')).toEqual({})
    expect(dotHandler.modifyResist!(shredding, ctx(), 'magic')).toEqual({})
    expect(dotHandler.modifyResist!(shredding, ctx({ opponent: active }), 'physical')).toEqual({})
  })

  it('does nothing for a dot without shredWhileActive', () => {
    const opponent = runtime({ buffs: { 'dot:e1': { expiresAt: 6 } } })
    expect(dotHandler.modifyResist!(effect, ctx({ opponent }), 'magic')).toEqual({})
  })
})

describe('dot appliedBy and maxStacks', () => {
  const bleed = {
    ...effect, id: 'bleed', damageType: 'physical' as const, tickAmount: 4, tickIntervalSeconds: 1,
    durationSeconds: 5, refresh: 'stack' as const, maxStacks: 3, appliedBy: ['basicAttack' as const, 'q' as const],
  }

  it('applies on a basic attack only when appliedBy lists it', () => {
    const opponent = runtime()
    dotHandler.hooks!.onBasicAttack!(effect, ctx({ opponent, scheduleEvent: () => {} }))
    expect(opponent.buffs['dot:e1']).toBeUndefined()
    dotHandler.hooks!.onBasicAttack!(bleed, ctx({ opponent, scheduleEvent: () => {} }))
    expect(opponent.buffs['dot:bleed']).toEqual({ expiresAt: 5, stacks: 1 })
  })

  it('applies on an ability hit only for the listed slots', () => {
    const opponent = runtime()
    dotHandler.hooks!.onAbilityHit!(bleed, ctx({ opponent, scheduleEvent: () => {} }), 'e', [])
    expect(opponent.buffs['dot:bleed']).toBeUndefined()
    dotHandler.hooks!.onAbilityHit!(bleed, ctx({ opponent, scheduleEvent: () => {} }), 'q', [])
    expect(opponent.buffs['dot:bleed']?.stacks).toBe(1)
  })

  it('restarts the whole dot at the new stack count, capped, cancelling the old ticks', () => {
    const opponent = runtime()
    const ticks: Array<{ at: number; amount: number }> = []
    const cancelled: string[] = []
    const apply = (time: number) => dotHandler.hooks!.onBasicAttack!(bleed, ctx({
      time, opponent,
      cancelScheduled: (key) => {
        cancelled.push(key)
        for (let i = ticks.length - 1; i >= 0; i--) if (ticks[i].at > time) ticks.splice(i, 1)
      },
      scheduleEvent: (at, run) => run(ctx({
        dealDamage: (input) => {
          ticks.push({ at, amount: input.amount })
          return { time: at, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
        },
      })),
    }))
    for (const time of [0, 1, 2, 3]) apply(time)
    expect(opponent.buffs['dot:bleed']).toEqual({ expiresAt: 8, stacks: 3 })
    expect(cancelled).toEqual(['dot:bleed', 'dot:bleed', 'dot:bleed'])
    // The last application's five ticks, each at the 3-stack cap.
    expect(ticks.filter((tick) => tick.at > 3)).toEqual([4, 5, 6, 7, 8].map((at) => ({ at, amount: 12 })))
  })

  it('starts over at one stack once the dot has expired', () => {
    const opponent = runtime({ buffs: { 'dot:bleed': { expiresAt: 5, stacks: 3 } } })
    dotHandler.hooks!.onBasicAttack!(bleed, ctx({ time: 6, opponent, scheduleEvent: () => {}, cancelScheduled: () => {} }))
    expect(opponent.buffs['dot:bleed']).toEqual({ expiresAt: 11, stacks: 1 })
  })
})
