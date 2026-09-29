import { describe, it, expect } from 'vitest'
import type { EmpoweredAttackEffect } from '@wr-calc/schema'
import { empoweredAttackHandler } from '../../src/effects/empowered-attack'
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
    time: 0, level: 15, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'dummy', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    resolveComponent: (component) => ({ type: component.type, amount: 40, dataWarnings: [] }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const feint: EmpoweredAttackEffect = {
  id: 'step', name: 'Step', description: '', support: 'full', kind: 'empoweredAttack',
  grant: { on: 'dashAfterAbility', withinSeconds: 0.5 },
  maxCharges: 3, durationSeconds: 4, attackSpeedBonus: 0.5,
  bonus: { type: 'physical', base: 40, ratios: [], tags: [] },
}

describe('empoweredAttackHandler', () => {
  it('grants a charge on a dash that starts within the window of an unused cast', () => {
    const self = runtime({ lastAbilityCast: { at: 1, feintUsed: false } })
    empoweredAttackHandler.hooks!.onDash!(feint, ctx({ self, time: 1.6 }), 1.4)
    expect(self.buffs['empowered:step']).toEqual({ stacks: 1, expiresAt: 5.6 })
  })

  it('grants nothing without a cast, after a used feint, or when the dash starts too late', () => {
    for (const lastAbilityCast of [undefined, { at: 1, feintUsed: true }, { at: 1, feintUsed: false }]) {
      const self = runtime({ lastAbilityCast })
      const startedAt = lastAbilityCast?.feintUsed === false ? 1.6 : 1.1
      empoweredAttackHandler.hooks!.onDash!(feint, ctx({ self, time: startedAt + 0.2 }), startedAt)
      expect(self.buffs['empowered:step']).toBeUndefined()
    }
  })

  it('caps charges and refreshes one shared expiry on each grant', () => {
    const self = runtime({ buffs: { 'empowered:step': { stacks: 3, expiresAt: 3 } } })
    const effect = { ...feint, grant: { on: 'abilityCast' as const } }
    empoweredAttackHandler.hooks!.onAbilityCast!(effect, ctx({ self, time: 2 }), 'q')
    expect(self.buffs['empowered:step']).toEqual({ stacks: 3, expiresAt: 6 })
  })

  it('only grants on cast for the listed slots', () => {
    const self = runtime()
    const effect = { ...feint, grant: { on: 'abilityCast' as const, slots: ['w' as const] } }
    empoweredAttackHandler.hooks!.onAbilityCast!(effect, ctx({ self }), 'q')
    expect(self.buffs['empowered:step']).toBeUndefined()
    empoweredAttackHandler.hooks!.onAbilityCast!(effect, ctx({ self }), 'w')
    expect(self.buffs['empowered:step']?.stacks).toBe(1)
  })

  it('spends one charge per basic attack: bonus damage as its own instance and swing attack speed', () => {
    const self = runtime({ buffs: { 'empowered:step': { stacks: 2, expiresAt: 4 } } })
    const dealt: { id: string; kind: string; amount: number }[] = []
    const c = ctx({
      self, time: 1,
      dealDamage: (input) => {
        dealt.push({ id: input.source.id, kind: input.source.kind, amount: input.amount })
        return { time: 1, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    empoweredAttackHandler.hooks!.onBasicAttack!(feint, c)
    expect(dealt).toEqual([{ id: 'step', kind: 'basicAttack', amount: 40 }])
    expect(self.buffs['empowered:step'].stacks).toBe(1)
    expect(self.swingAttackSpeedBonus).toBe(0.5)
  })

  it('does nothing on a basic attack once the charges have expired', () => {
    const self = runtime({ buffs: { 'empowered:step': { stacks: 2, expiresAt: 4 } } })
    let called = false
    empoweredAttackHandler.hooks!.onBasicAttack!(feint, ctx({
      self, time: 4.1,
      dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } },
    }))
    expect(called).toBe(false)
    expect(self.swingAttackSpeedBonus).toBeUndefined()
  })
})
