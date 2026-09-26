import { describe, it, expect } from 'vitest'
import { combatRampAmpHandler } from '../../src/effects/combat-ramp-amp'
import type { HookContext, CombatantRuntime, RawDamageInstanceInput } from '../../src/effects/types'
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
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'magic', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const input: RawDamageInstanceInput = {
  type: 'magic', amount: 100, source: { kind: 'ability', id: 'q', name: 'Q' },
}

const effect = {
  id: 'madness', name: 'Madness', description: '', support: 'full' as const,
  kind: 'combatRampAmp' as const, amountPerStack: 0.02, stackIntervalSeconds: 1, maxStacks: 3,
}

describe('combatRampAmpHandler.damageMultiplier', () => {
  it('does not amplify the hit that starts combat', () => {
    expect(combatRampAmpHandler.damageMultiplier!(effect, ctx(), input)).toBe(1)
  })

  it('gives one stack on entering combat and one more per full interval, up to maxStacks', () => {
    // Measured 2026-09-26: Liandry's 0.5s burn ticks after the opening Q read 76, 78, 78, 79, 79,
    // 79 against a 74.6 base, i.e. +2%, +4%, +4%, +6%, +6%, +6%.
    const self = runtime({ combatStartedAt: 10 })
    const at = (time: number) => combatRampAmpHandler.damageMultiplier!(effect, ctx({ self, time }), input)
    expect([10.5, 11, 11.5, 12, 12.5, 13, 20].map(at).map((m) => Number(m.toFixed(4))))
      .toEqual([1.02, 1.04, 1.04, 1.06, 1.06, 1.06, 1.06])
  })

  it('returns 1 when its optional condition is not met', () => {
    const conditioned = { ...effect, condition: { type: 'targetIsChampion' as const } }
    const self = runtime({ combatStartedAt: 0 })
    expect(combatRampAmpHandler.damageMultiplier!(
      conditioned, ctx({ self, time: 5, conditionMet: () => false }), input
    )).toBe(1)
  })
})
