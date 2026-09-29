import { describe, it, expect } from 'vitest'
import { spellbladeHandler } from '../../src/effects/spellblade'
import type { HookContext, CombatantRuntime } from '../../src/effects/types'
import type { StatSheet } from '../../src/resolve-stats'

function runtime(overrides: Partial<CombatantRuntime> = {}): CombatantRuntime {
  return { currentHp: 1000, shieldHp: 0, cooldowns: {}, buffs: {}, ...overrides }
}

function sheet(overrides: Partial<StatSheet> = {}): StatSheet {
  return {
    base: {}, bonus: {}, total: {}, breakdown: [], unsupportedEffects: [], dataWarnings: [],
    unverifiedRules: [], ...overrides,
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
  id: 'e1', name: 'Test Spellblade', description: '', support: 'full' as const,
  kind: 'spellblade' as const, damageType: 'physical' as const, bonusDamage: 10,
  ratios: [{ stat: 'ad' as const, value: 0.5 }], internalCooldownSeconds: 1.5,
}

describe('spellbladeHandler', () => {
  it('does nothing on a basic attack when not primed', () => {
    let called = false
    const c = ctx({ dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } } })
    spellbladeHandler.hooks!.onBasicAttack!(effect, c)
    expect(called).toBe(false)
  })

  it('primes on ability cast and consumes on the next basic attack', () => {
    const self = runtime()
    const c = ctx({ self, selfSheet: sheet({ total: { ad: 100 } }) })
    spellbladeHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.buffs['spellblade:e1']).toBeDefined()

    let dealt: { type: string; amount: number } | undefined
    const consumeCtx = ctx({
      self, selfSheet: sheet({ total: { ad: 100 } }),
      dealDamage: (input) => {
        dealt = { type: input.type, amount: input.amount }
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    spellbladeHandler.hooks!.onBasicAttack!(effect, consumeCtx)
    expect(dealt).toEqual({ type: 'physical', amount: 60 })
    expect(self.buffs['spellblade:e1']).toBeUndefined()
    expect(self.cooldowns['spellblade:e1']).toBe(1.5)
  })

  it('reads a ratio from the layer it names', () => {
    const self = runtime({ buffs: { 'spellblade:e2': {} } })
    const layered = {
      ...effect, id: 'e2', damageType: 'magic' as const, bonusDamage: 0,
      ratios: [
        { stat: 'ad' as const, layer: 'base' as const, value: 0.75 },
        { stat: 'ap' as const, value: 0.45 },
      ],
    }
    let amount: number | undefined
    const c = ctx({
      self, selfSheet: sheet({ base: { ad: 89 }, bonus: { ad: 40 }, total: { ad: 129, ap: 611 } }),
      dealDamage: (input) => {
        amount = input.amount
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    spellbladeHandler.hooks!.onBasicAttack!(layered, c)
    expect(amount).toBeCloseTo(0.75 * 89 + 0.45 * 611, 10)
  })

  it('does not re-prime while on internal cooldown', () => {
    const self = runtime({ cooldowns: { 'spellblade:e1': 10 } })
    const c = ctx({ self, time: 5 })
    spellbladeHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.buffs['spellblade:e1']).toBeUndefined()
  })
})
