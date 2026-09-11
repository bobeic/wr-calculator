import { describe, it, expect } from 'vitest'
import { cooldownRefundHandler } from '../../src/effects/cooldown-refund'
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
    time: 10, level: 5, self: runtime(), opponent: runtime(), selfSheet: sheet(),
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

describe('cooldownRefundHandler.onAbilityHit', () => {
  it('reduces a flat amount off every active non-ultimate cooldown', () => {
    const self = runtime({ cooldowns: { q: 18, w: 12, r: 100 } })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 3, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns).toEqual({ q: 15, w: 10, r: 100 })
  })

  it('clamps a flat refund at the current time', () => {
    const self = runtime({ cooldowns: { q: 11 } })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 5, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns.q).toBe(10)
  })

  it('reduces remaining cooldown by a percentage', () => {
    const self = runtime({ cooldowns: { q: 20 } }) // 10s remaining at time 10
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'percent' as const, amount: 0.5, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns.q).toBe(15)
  })

  it('includes the ultimate when excludesUltimate is false', () => {
    const self = runtime({ cooldowns: { r: 100 } })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 10, excludesUltimate: false,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns.r).toBe(90)
  })

  it('leaves abilities that are not on cooldown untouched', () => {
    const self = runtime({ cooldowns: {} })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Refund', description: '', support: 'full' as const,
      kind: 'cooldownRefund' as const, mode: 'flat' as const, amount: 10, excludesUltimate: true,
    }
    cooldownRefundHandler.hooks!.onAbilityHit!(effect, c, 'q', [])
    expect(self.cooldowns).toEqual({})
  })
})
