import { describe, it, expect } from 'vitest'
import { damageReductionHandler } from '../../src/effects/damage-reduction'
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

describe('damageReductionHandler.damageReductionFraction', () => {
  it('applies to a matching specific damage type', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'magic' as const, amount: 0.2,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'magic')).toBe(0.2)
  })

  it('does not apply to a non-matching specific damage type', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'magic' as const, amount: 0.2,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'physical')).toBe(0)
  })

  it('applies to every damage type when damageType is "all"', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'all' as const, amount: 0.15,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'true')).toBe(0.15)
  })

  it('respects an optional condition', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'all' as const, amount: 0.15,
      condition: { type: 'targetHpBelow' as const, threshold: 0.3 },
    }
    expect(damageReductionHandler.damageReductionFraction!(
      effect, ctx({ conditionMet: () => false }), 'physical'
    )).toBe(0)
  })

  it('flags a data warning and treats amount as 0 when null', () => {
    const effect = {
      id: 'e1', name: 'Test Reduction', description: '', support: 'full' as const,
      kind: 'damageReduction' as const, damageType: 'all' as const, amount: null,
    }
    expect(damageReductionHandler.damageReductionFraction!(effect, ctx(), 'physical')).toBe(0)
  })
})
