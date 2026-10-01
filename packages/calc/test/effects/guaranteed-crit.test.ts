import { describe, it, expect } from 'vitest'
import type { GuaranteedCritEffect } from '@wr-calc/schema'
import { guaranteedCritHandler } from '../../src/effects/guaranteed-crit'
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
    dealDamage: (input) => ({ time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const strike: GuaranteedCritEffect = {
  id: 'strike', name: 'Strike', description: '', support: 'full', kind: 'guaranteedCrit',
  critMultiplier: 1.6, cooldownSeconds: 6,
}

describe('guaranteedCritHandler', () => {
  it('crits the next attack and starts the cooldown', () => {
    const self = runtime()
    expect(guaranteedCritHandler.hooks!.beforeBasicAttack!(strike, ctx({ self, time: 2 }))).toEqual({ critMultiplier: 1.6 })
    expect(self.cooldowns['guaranteedCrit:strike']).toBe(8)
  })

  it('does nothing while on cooldown', () => {
    const self = runtime({ cooldowns: { 'guaranteedCrit:strike': 8 } })
    expect(guaranteedCritHandler.hooks!.beforeBasicAttack!(strike, ctx({ self, time: 5 }))).toBeUndefined()
  })
})
