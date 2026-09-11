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
  durationSeconds: 6, refresh: 'refresh' as const,
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
