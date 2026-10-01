import { describe, it, expect } from 'vitest'
import type { HitStackAmpEffect } from '@wr-calc/schema'
import { hitStackAmpHandler } from '../../src/effects/hit-stack-amp'
import type { HookContext, CombatantRuntime, HitInfo } from '../../src/effects/types'
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
    dealDamage: (input) => ({ time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const focusedWill: HitStackAmpEffect = {
  id: 'will', name: 'Will', description: '', support: 'full', kind: 'hitStackAmp',
  amountPerStack: 0.03, maxStacks: 4, durationSeconds: 6, appliesTo: ['ability', 'passive'],
}
const hit: HitInfo = { id: 1, kind: 'ability', empowered: false, abilityKey: 'q' }
const abilityDamage = { type: 'physical' as const, amount: 100, source: { kind: 'ability' as const, id: 'q', name: 'Q' } }
const attackDamage = { type: 'physical' as const, amount: 100, source: { kind: 'basicAttack' as const, id: 'AA', name: 'AA' } }

describe('hitStackAmpHandler', () => {
  it('adds a stack per hit up to the cap, refreshing the duration', () => {
    const self = runtime()
    for (let i = 0; i < 5; i++) hitStackAmpHandler.hooks!.onHitLanded!(focusedWill, ctx({ self, time: i }), hit)
    expect(self.buffs['hitStackAmp:will']).toEqual({ stacks: 4, expiresAt: 10 })
  })

  it('amplifies only the listed source kinds by its live stacks', () => {
    const self = runtime({ buffs: { 'hitStackAmp:will': { stacks: 3, expiresAt: 6 } } })
    expect(hitStackAmpHandler.damageMultiplier!(focusedWill, ctx({ self, time: 1 }), abilityDamage)).toBeCloseTo(1.09, 10)
    expect(hitStackAmpHandler.damageMultiplier!(focusedWill, ctx({ self, time: 1 }), attackDamage)).toBe(1)
  })

  it('does not amplify while its own condition fails', () => {
    const self = runtime({ buffs: { 'hitStackAmp:will': { stacks: 3, expiresAt: 6 } } })
    const conditional: HitStackAmpEffect = { ...focusedWill, condition: { type: 'sourceKind', value: 'passive' } }
    const failing = ctx({ self, time: 1, conditionMet: () => false })
    expect(hitStackAmpHandler.damageMultiplier!(conditional, failing, abilityDamage)).toBe(1)
  })

  it('does nothing once the stacks have expired, and restarts from one', () => {
    const self = runtime({ buffs: { 'hitStackAmp:will': { stacks: 3, expiresAt: 6 } } })
    expect(hitStackAmpHandler.damageMultiplier!(focusedWill, ctx({ self, time: 7 }), abilityDamage)).toBe(1)
    hitStackAmpHandler.hooks!.onHitLanded!(focusedWill, ctx({ self, time: 7 }), hit)
    expect(self.buffs['hitStackAmp:will']).toEqual({ stacks: 1, expiresAt: 13 })
  })
})
