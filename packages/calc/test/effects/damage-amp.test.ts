import { describe, it, expect } from 'vitest'
import { damageAmpHandler } from '../../src/effects/damage-amp'
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
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'physical', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const input: RawDamageInstanceInput = {
  type: 'physical', amount: 100, source: { kind: 'basicAttack', id: 'aa', name: 'Attack' },
}

const effect = {
  id: 'e1', name: 'Test Amp', description: '', support: 'full' as const,
  kind: 'damageAmp' as const, condition: { type: 'targetHpBelow' as const, threshold: 0.5 },
  amount: 0.1,
}

describe('damageAmpHandler.damageMultiplier', () => {
  it('returns 1 + amount when the condition is met', () => {
    const result = damageAmpHandler.damageMultiplier!(effect, ctx({ conditionMet: () => true }), input)
    expect(result).toBe(1.1)
  })

  it('returns 1 when the condition is not met', () => {
    const result = damageAmpHandler.damageMultiplier!(effect, ctx({ conditionMet: () => false }), input)
    expect(result).toBe(1)
  })

  it('flags a data warning and treats amount as 0 when null', () => {
    const c = ctx({ conditionMet: () => true })
    const result = damageAmpHandler.damageMultiplier!({ ...effect, amount: null }, c, input)
    expect(result).toBe(1)
  })
})
