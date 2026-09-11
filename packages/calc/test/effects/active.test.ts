import { describe, it, expect } from 'vitest'
import { activeHandler } from '../../src/effects/active'
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
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

describe('activeHandler.activate', () => {
  it('deals damage when damage and damageType are set', () => {
    const effect = {
      id: 'e1', name: 'Test Active', description: '', support: 'full' as const,
      kind: 'active' as const, cooldownSeconds: 60, damageType: 'magic' as const, damage: 80,
    }
    let dealt: { type: string; amount: number } | undefined
    const c = ctx({
      dealDamage: (input) => {
        dealt = { type: input.type, amount: input.amount }
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    activeHandler.activate!(effect, c)
    expect(dealt).toEqual({ type: 'magic', amount: 80 })
  })

  it('does nothing when this active has no damage component', () => {
    const effect = {
      id: 'e1', name: 'Test Active', description: '', support: 'full' as const,
      kind: 'active' as const, cooldownSeconds: 60,
    }
    let called = false
    const c = ctx({ dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } } })
    activeHandler.activate!(effect, c)
    expect(called).toBe(false)
  })

  it('flags a data warning when damage is null', () => {
    const effect = {
      id: 'e1', name: 'Test Active', description: '', support: 'full' as const,
      kind: 'active' as const, cooldownSeconds: 60, damageType: 'true' as const, damage: null,
    }
    let warned: string | undefined
    activeHandler.activate!(effect, ctx({ addDataWarning: (m) => { warned = m } }))
    expect(warned).toBe('Test Active: damage is unverified (null)')
  })
})
