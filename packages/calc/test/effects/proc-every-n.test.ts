import { describe, it, expect } from 'vitest'
import { procEveryNHandler } from '../../src/effects/proc-every-n'
import type { HookContext, CombatantRuntime, DamageInstance } from '../../src/effects/types'
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
    dealDamage: (input) => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

function otherInstance(): DamageInstance {
  return {
    time: 0, source: { kind: 'basicAttack', id: 'aa', name: 'Attack' }, type: 'physical',
    raw: 10, mitigated: 10, targetHpAfter: 990,
  }
}

const effect = {
  id: 'e1', name: 'Test Proc', description: '', support: 'full' as const,
  kind: 'procEveryN' as const, n: 3, damageType: 'magic' as const, damage: 20,
  resetsOnMiss: false,
}

describe('procEveryNHandler.onDamageDealt', () => {
  it('increments the counter without proccing below n', () => {
    const self = runtime()
    const c = ctx({ self })
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, otherInstance())
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, otherInstance())
    expect(self.buffs['procEveryN:e1'].stacks).toBe(2)
  })

  it('procs on the nth hit and resets the counter', () => {
    const self = runtime({ buffs: { 'procEveryN:e1': { stacks: 2 } } })
    let dealt: { type: string; amount: number } | undefined
    const c = ctx({
      self,
      dealDamage: (input) => {
        dealt = { type: input.type, amount: input.amount }
        return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
      },
    })
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, otherInstance())
    expect(dealt).toEqual({ type: 'magic', amount: 20 })
    expect(self.buffs['procEveryN:e1'].stacks).toBe(0)
  })

  it('ignores its own proc instance to avoid re-triggering itself', () => {
    const self = runtime({ buffs: { 'procEveryN:e1': { stacks: 5 } } })
    const c = ctx({ self })
    const ownInstance: DamageInstance = {
      ...otherInstance(), source: { kind: 'item', id: 'e1', name: 'Test Proc' },
    }
    procEveryNHandler.hooks!.onDamageDealt!(effect, c, ownInstance)
    expect(self.buffs['procEveryN:e1'].stacks).toBe(5)
  })

  it('resets without dealing damage when damage is not set', () => {
    const self = runtime({ buffs: { 'procEveryN:e1': { stacks: 2 } } })
    let called = false
    const c = ctx({ self, dealDamage: (input) => { called = true; return { time: 0, source: input.source, type: input.type, raw: 0, mitigated: 0, targetHpAfter: 0 } } })
    procEveryNHandler.hooks!.onDamageDealt!({ ...effect, damage: undefined }, c, otherInstance())
    expect(called).toBe(false)
    expect(self.buffs['procEveryN:e1'].stacks).toBe(0)
  })
})
