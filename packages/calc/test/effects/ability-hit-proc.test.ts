import { describe, it, expect } from 'vitest'
import type { AbilityHitProcEffect } from '@wr-calc/schema'
import { abilityHitProcHandler } from '../../src/effects/ability-hit-proc'
import type { HookContext, CombatantRuntime, DamageInstance, RawDamageInstanceInput } from '../../src/effects/types'
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

function instance(raw: number): DamageInstance {
  return {
    time: 0, source: { kind: 'ability', id: 'q', name: 'Q' }, type: 'magic', raw,
    mitigated: raw, targetHpAfter: 0,
  }
}

function ctx(dealt: RawDamageInstanceInput[], overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 15, self: runtime(), opponent: runtime(),
    selfSheet: sheet({ total: { ap: 500 } }), opponentSheet: sheet(),
    selfKind: 'champion', opponentKind: 'dummy', inputs: {}, ignoreCooldowns: false,
    dealDamage: (input) => {
      dealt.push(input)
      return { ...instance(input.amount), source: input.source, type: input.type }
    },
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const effect: AbilityHitProcEffect = {
  id: 'test-echo', name: 'Test Echo', description: '', support: 'full',
  kind: 'abilityHitProc', damageType: 'magic', damage: 175,
  ratios: [{ stat: 'ap', value: 0.14 }], cooldownSeconds: 9,
  startOnCooldownInputId: 'test-echo-on-cooldown',
}

const onAbilityHit = abilityHitProcHandler.hooks!.onAbilityHit!

describe('abilityHitProcHandler', () => {
  it('deals flat + ratio damage on a damaging ability hit and goes on cooldown', () => {
    const dealt: RawDamageInstanceInput[] = []
    const c = ctx(dealt, { time: 2 })
    onAbilityHit(effect, c, 'q', [instance(300)])
    expect(dealt).toEqual([{
      type: 'magic', amount: 175 + 500 * 0.14,
      source: { kind: 'item', id: 'test-echo', name: 'Test Echo' },
    }])
    expect(c.self.cooldowns['abilityHitProc:test-echo']).toBe(11)
  })

  it('does not proc on an ability that dealt no damage', () => {
    const dealt: RawDamageInstanceInput[] = []
    onAbilityHit(effect, ctx(dealt), 'e', [])
    onAbilityHit(effect, ctx(dealt), 'e', [instance(0)])
    expect(dealt).toEqual([])
  })

  it('does not proc while on cooldown, and procs again once it has elapsed', () => {
    const dealt: RawDamageInstanceInput[] = []
    const self = runtime({ cooldowns: { 'abilityHitProc:test-echo': 9 } })
    onAbilityHit(effect, ctx(dealt, { self, time: 8.9 }), 'w', [instance(300)])
    expect(dealt).toHaveLength(0)
    onAbilityHit(effect, ctx(dealt, { self, time: 9 }), 'w', [instance(300)])
    expect(dealt).toHaveLength(1)
  })

  it('procs through its cooldown when cooldowns are ignored', () => {
    const dealt: RawDamageInstanceInput[] = []
    const self = runtime({ cooldowns: { 'abilityHitProc:test-echo': 9 } })
    onAbilityHit(effect, ctx(dealt, { self, time: 1, ignoreCooldowns: true }), 'q', [instance(300)])
    expect(dealt).toHaveLength(1)
  })

  it('starts on a full cooldown when its start-on-cooldown input is on', () => {
    const dealt: RawDamageInstanceInput[] = []
    const inputs = { 'test-echo-on-cooldown': true }
    const self = runtime()
    onAbilityHit(effect, ctx(dealt, { self, inputs, time: 0 }), 'q', [instance(300)])
    onAbilityHit(effect, ctx(dealt, { self, inputs, time: 8.9 }), 'w', [instance(300)])
    expect(dealt).toHaveLength(0)
    onAbilityHit(effect, ctx(dealt, { self, inputs, time: 9 }), 'r', [instance(300)])
    expect(dealt).toHaveLength(1)
  })
})
