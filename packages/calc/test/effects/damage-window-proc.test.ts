import { describe, it, expect } from 'vitest'
import type { DamageWindowProcEffect } from '@wr-calc/schema'
import { damageWindowProcHandler } from '../../src/effects/damage-window-proc'
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

function hit(time: number, mitigated: number, sourceId = 'q'): DamageInstance {
  return {
    time, source: { kind: 'ability', id: sourceId, name: sourceId }, type: 'magic',
    raw: mitigated, mitigated, targetHpAfter: 0,
  }
}

interface Scheduled { atTime: number; run: (ctx: HookContext) => void }

function ctx(self: CombatantRuntime, scheduled: Scheduled[], overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 15, self, opponent: runtime(),
    selfSheet: sheet({ total: { ap: 500 } }), opponentSheet: sheet({ total: { hp: 1000 } }),
    selfKind: 'champion', opponentKind: 'dummy', inputs: {}, ignoreCooldowns: false,
    dealDamage: (input) => ({ ...hit(0, input.amount), source: input.source, type: input.type }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    scheduleEvent: (atTime, run) => { scheduled.push({ atTime, run }) },
    ...overrides,
  }
}

const effect: DamageWindowProcEffect = {
  id: 'test-squall', name: 'Test Squall', description: '', support: 'full',
  kind: 'damageWindowProc', targetMaxHpFraction: 0.25, windowSeconds: 2.5, delaySeconds: 2,
  damageType: 'magic', damage: 125, ratios: [{ stat: 'ap', value: 0.1 }], cooldownSeconds: 25,
}

const onDamageDealt = damageWindowProcHandler.hooks!.onDamageDealt!

function deal(self: CombatantRuntime, scheduled: Scheduled[], instance: DamageInstance, overrides: Partial<HookContext> = {}) {
  onDamageDealt(effect, ctx(self, scheduled, { time: instance.time, ...overrides }), instance)
}

describe('damageWindowProcHandler', () => {
  it('does nothing while damage in the window stays below the threshold', () => {
    const self = runtime()
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(0, 120))
    deal(self, scheduled, hit(1, 120))
    expect(scheduled).toEqual([])
  })

  it('schedules flat + ratio damage after the delay once the window reaches the threshold, then goes on cooldown', () => {
    const self = runtime()
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(0, 150))
    deal(self, scheduled, hit(1, 150))
    expect(scheduled.map((s) => s.atTime)).toEqual([3])
    expect(self.cooldowns['damageWindowProc:test-squall']).toBe(26)

    const dealt: RawDamageInstanceInput[] = []
    scheduled[0].run(ctx(self, [], {
      dealDamage: (input) => { dealt.push(input); return hit(3, input.amount) },
    }))
    expect(dealt).toEqual([{
      type: 'magic', amount: 125 + 500 * 0.1,
      source: { kind: 'item', id: 'test-squall', name: 'Test Squall' },
    }])
  })

  it('forgets damage older than the window', () => {
    const self = runtime()
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(0, 150))
    deal(self, scheduled, hit(2.6, 150))
    expect(scheduled).toEqual([])
  })

  it('sums instances that land at the same time', () => {
    const self = runtime()
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(1, 125))
    deal(self, scheduled, hit(1, 125))
    expect(scheduled.map((s) => s.atTime)).toEqual([3])
  })

  it('does not trigger while on cooldown, or count damage dealt during it', () => {
    const self = runtime({ cooldowns: { 'damageWindowProc:test-squall': 10 } })
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(9, 300))
    deal(self, scheduled, hit(10, 10))
    expect(scheduled).toEqual([])
  })

  it('triggers through its cooldown when cooldowns are ignored', () => {
    const self = runtime({ cooldowns: { 'damageWindowProc:test-squall': 10 } })
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(9, 300), { ignoreCooldowns: true })
    expect(scheduled).toHaveLength(1)
  })

  it('ignores its own damage', () => {
    const self = runtime()
    const scheduled: Scheduled[] = []
    deal(self, scheduled, hit(0, 300, 'test-squall'))
    expect(scheduled).toEqual([])
  })
})
