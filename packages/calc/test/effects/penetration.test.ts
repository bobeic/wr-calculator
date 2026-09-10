import { describe, it, expect } from 'vitest'
import { penetrationHandler } from '../../src/effects/penetration'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {} }
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

const effect = {
  id: 'e1', name: 'Test Pen', description: '', support: 'full' as const,
  kind: 'penetration' as const, resist: 'armor' as const, mode: 'percent' as const, amount: 0.3,
  condition: { type: 'targetHpAbove' as const, threshold: 0.7 },
}

describe('penetrationHandler.modifyResist', () => {
  it('contributes pctPen for percent-mode armor pen against physical damage', () => {
    const result = penetrationHandler.modifyResist!(effect, ctx({ conditionMet: () => true }), 'physical')
    expect(result).toEqual({ pctPen: 0.3 })
  })

  it('contributes flatPen for flat-mode pen', () => {
    const flatEffect = { ...effect, mode: 'flat' as const, amount: 15 }
    const result = penetrationHandler.modifyResist!(flatEffect, ctx({ conditionMet: () => true }), 'physical')
    expect(result).toEqual({ flatPen: 15 })
  })

  it('contributes nothing when the condition is not met', () => {
    const result = penetrationHandler.modifyResist!(effect, ctx({ conditionMet: () => false }), 'physical')
    expect(result).toEqual({})
  })

  it('contributes nothing when the damage type does not match the targeted resist', () => {
    const result = penetrationHandler.modifyResist!(effect, ctx({ conditionMet: () => true }), 'magic')
    expect(result).toEqual({})
  })
})
