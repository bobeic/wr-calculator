import { describe, it, expect } from 'vitest'
import { resistShredHandler } from '../../src/effects/resist-shred'
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
    dealDamage: () => ({ time: 0, source: { kind: 'other', id: '', name: '' }, type: 'physical', raw: 0, mitigated: 0, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const nonStacking = {
  id: 'e1', name: 'Test Shred', description: '', support: 'full' as const,
  kind: 'resistShred' as const, resist: 'armor' as const, mode: 'flat' as const, amount: 5,
  stacking: false,
}

const stacking = { ...nonStacking, stacking: true, maxStacks: 3, amount: 4 }

describe('resistShredHandler.onDamageDealt', () => {
  it('sets a single stack for a non-stacking shred', () => {
    const c = ctx()
    resistShredHandler.hooks!.onDamageDealt!(nonStacking, c, {} as never)
    expect(c.opponent.buffs['resistShred:e1'].stacks).toBe(1)
  })

  it('increments stacks up to maxStacks for a stacking shred', () => {
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 3 } } }) })
    resistShredHandler.hooks!.onDamageDealt!(stacking, c, {} as never)
    expect(c.opponent.buffs['resistShred:e1'].stacks).toBe(3)
  })

  it('flags a data warning when durationSeconds is null', () => {
    const warnings: string[] = []
    const c = ctx({ addDataWarning: (message) => warnings.push(message) })
    const effect = { ...nonStacking, durationSeconds: null }
    resistShredHandler.hooks!.onDamageDealt!(effect, c, {} as never)
    expect(warnings).toEqual(['Test Shred: durationSeconds is unverified (null)'])
  })

  it('sets expiresAt to the current time (not undefined) when durationSeconds is null', () => {
    const c = ctx({ time: 7 })
    const effect = { ...nonStacking, durationSeconds: null }
    resistShredHandler.hooks!.onDamageDealt!(effect, c, {} as never)
    expect(c.opponent.buffs['resistShred:e1'].expiresAt).toBe(7)
  })
})

describe('resistShredHandler.modifyResist', () => {
  it('returns nothing when no stack is active', () => {
    expect(resistShredHandler.modifyResist!(nonStacking, ctx(), 'physical')).toEqual({})
  })

  it('returns nothing once the buff has expired', () => {
    const c = ctx({
      time: 10, opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1, expiresAt: 5 } } }),
    })
    expect(resistShredHandler.modifyResist!(nonStacking, c, 'physical')).toEqual({})
  })

  it('returns nothing for a non-matching damage type', () => {
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1 } } }) })
    expect(resistShredHandler.modifyResist!(nonStacking, c, 'magic')).toEqual({})
  })

  it('scales flat-mode shred by stack count', () => {
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 3 } } }) })
    expect(resistShredHandler.modifyResist!(stacking, c, 'physical')).toEqual({ flatReduction: 12 })
  })

  it('reports percent-mode shred as pctReduction', () => {
    const percentEffect = { ...nonStacking, mode: 'percent' as const, amount: 0.1 }
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1 } } }) })
    expect(resistShredHandler.modifyResist!(percentEffect, c, 'physical')).toEqual({ pctReduction: 0.1 })
  })

  it('applies normally when its condition is met', () => {
    const effect = { ...nonStacking, condition: { type: 'targetHpBelow' as const, threshold: 0.3 } }
    const c = ctx({ opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1 } } }) })
    expect(resistShredHandler.modifyResist!(effect, c, 'physical')).toEqual({ flatReduction: 5 })
  })

  it('returns nothing when its condition is not met, even with an active buff', () => {
    const effect = { ...nonStacking, condition: { type: 'targetHpBelow' as const, threshold: 0.3 } }
    const c = ctx({
      conditionMet: () => false,
      opponent: runtime({ buffs: { 'resistShred:e1': { stacks: 1 } } }),
    })
    expect(resistShredHandler.modifyResist!(effect, c, 'physical')).toEqual({})
  })
})
