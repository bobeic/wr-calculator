import { describe, it, expect } from 'vitest'
import { shieldHandler, healHandler } from '../../src/effects/shield-heal'
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

describe('shieldHandler.onAbilityCast', () => {
  it('adds to the caster shieldHp', () => {
    const self = runtime({ shieldHp: 10 })
    const c = ctx({ self })
    const effect = {
      id: 'e1', name: 'Test Shield', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: 50, durationSeconds: 3,
    }
    shieldHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.shieldHp).toBe(60)
  })

  it('flags a data warning when amount is null', () => {
    const c = ctx()
    const effect = {
      id: 'e1', name: 'Test Shield', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: null, durationSeconds: 3,
    }
    let warned: string | undefined
    shieldHandler.hooks!.onAbilityCast!(effect, ctx({ addDataWarning: (m) => { warned = m } }), 'q')
    expect(warned).toBe('Test Shield: amount is unverified (null)')
  })
})

describe('healHandler.onAbilityCast', () => {
  it('adds to current hp', () => {
    const self = runtime({ currentHp: 500 })
    const c = ctx({ self, selfSheet: sheet({ total: { hp: 1000 } }) })
    const effect = {
      id: 'e1', name: 'Test Heal', description: '', support: 'full' as const,
      kind: 'heal' as const, amount: 100,
    }
    healHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.currentHp).toBe(600)
  })

  it('clamps healing at max hp', () => {
    const self = runtime({ currentHp: 950 })
    const c = ctx({ self, selfSheet: sheet({ total: { hp: 1000 } }) })
    const effect = {
      id: 'e1', name: 'Test Heal', description: '', support: 'full' as const,
      kind: 'heal' as const, amount: 200,
    }
    healHandler.hooks!.onAbilityCast!(effect, c, 'q')
    expect(self.currentHp).toBe(1000)
  })
})
