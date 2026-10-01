import { describe, it, expect } from 'vitest'
import type { HitStackProcEffect } from '@wr-calc/schema'
import { hitStackProcHandler } from '../../src/effects/hit-stack-proc'
import type { HookContext, CombatantRuntime, HitInfo, RawDamageInstanceInput } from '../../src/effects/types'
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
function ctx(dealt: RawDamageInstanceInput[], overrides: Partial<HookContext> = {}): HookContext {
  return {
    time: 0, level: 15, self: runtime(), opponent: runtime(), selfSheet: sheet(),
    opponentSheet: sheet(), selfKind: 'champion', opponentKind: 'dummy', inputs: {},
    ignoreCooldowns: false,
    dealDamage: (input) => {
      dealt.push(input)
      return { time: 0, source: input.source, type: input.type, raw: input.amount, mitigated: input.amount, targetHpAfter: 0 }
    },
    resolveComponent: (component) => ({ type: component.type, amount: 600, dataWarnings: [] }),
    addDataWarning: () => {}, addUnverifiedRule: () => {}, conditionMet: () => true,
    ...overrides,
  }
}

const eclipse: HitStackProcEffect = {
  id: 'moon', name: 'Moon', description: '', support: 'full', kind: 'hitStackProc',
  stacksToProc: 2, stackWindowSeconds: 1.8, cooldownSeconds: 6,
  stacksFrom: ['basicAttack', 'ability'],
  damage: { type: 'physical', base: 0, ratios: [{ stat: 'targetMaxHp', value: 0.06 }], tags: [] },
  delivery: { kind: 'instant' },
}
const attackHit: HitInfo = { id: 1, kind: 'basicAttack', empowered: false }
const abilityHit: HitInfo = { id: 2, kind: 'ability', empowered: false, abilityKey: 'q' }

describe('hitStackProcHandler', () => {
  it('stacks on the first hit and procs on the second, then starts the cooldown', () => {
    const dealt: RawDamageInstanceInput[] = []
    const self = runtime()
    const opponent = runtime()
    hitStackProcHandler.hooks!.onHitLanded!(eclipse, ctx(dealt, { self, opponent, time: 1 }), attackHit)
    expect(opponent.buffs['hitStackProc:moon']).toEqual({ stacks: 1, expiresAt: 2.8 })
    expect(dealt).toEqual([])
    hitStackProcHandler.hooks!.onHitLanded!(eclipse, ctx(dealt, { self, opponent, time: 2 }), abilityHit)
    expect(dealt).toEqual([{ type: 'physical', amount: 600, source: { kind: 'item', id: 'moon', name: 'Moon' } }])
    expect(opponent.buffs['hitStackProc:moon']).toBeUndefined()
    expect(self.cooldowns['hitStackProc:moon']).toBe(8)
  })

  it('lets a stack expire after the window', () => {
    const dealt: RawDamageInstanceInput[] = []
    const opponent = runtime({ buffs: { 'hitStackProc:moon': { stacks: 1, expiresAt: 2.8 } } })
    hitStackProcHandler.hooks!.onHitLanded!(eclipse, ctx(dealt, { opponent, time: 3 }), abilityHit)
    expect(dealt).toEqual([])
    expect(opponent.buffs['hitStackProc:moon']).toEqual({ stacks: 1, expiresAt: 4.8 })
  })

  it('builds no stacks while on cooldown', () => {
    const dealt: RawDamageInstanceInput[] = []
    const self = runtime({ cooldowns: { 'hitStackProc:moon': 8 } })
    const opponent = runtime()
    hitStackProcHandler.hooks!.onHitLanded!(eclipse, ctx(dealt, { self, opponent, time: 5 }), attackHit)
    expect(opponent.buffs['hitStackProc:moon']).toBeUndefined()
  })

  it('counts only the hit kinds it lists; an empowered attack counts as empoweredAttack', () => {
    const frostbite = { ...eclipse, stacksFrom: ['ability', 'empoweredAttack'] as HitStackProcEffect['stacksFrom'] }
    const opponent = runtime()
    hitStackProcHandler.hooks!.onHitLanded!(frostbite, ctx([], { opponent }), attackHit)
    expect(opponent.buffs['hitStackProc:moon']).toBeUndefined()
    hitStackProcHandler.hooks!.onHitLanded!(frostbite, ctx([], { opponent }), { ...attackHit, empowered: true })
    expect(opponent.buffs['hitStackProc:moon']?.stacks).toBe(1)
  })

  it('schedules dot delivery as equal ticks over the duration', () => {
    const scheduled: { at: number; run: (c: HookContext) => void }[] = []
    const frostbite: HitStackProcEffect = {
      ...eclipse, stacksToProc: 2, delivery: { kind: 'dot', tickIntervalSeconds: 0.25, durationSeconds: 2 },
    }
    const opponent = runtime({ buffs: { 'hitStackProc:moon': { stacks: 1, expiresAt: 5 } } })
    const dealt: RawDamageInstanceInput[] = []
    hitStackProcHandler.hooks!.onHitLanded!(frostbite, ctx(dealt, {
      opponent, time: 1, scheduleEvent: (at, run) => { scheduled.push({ at, run }) },
    }), abilityHit)
    expect(dealt).toEqual([])
    expect(scheduled.map((event) => event.at)).toEqual([1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3])
    scheduled[0].run(ctx(dealt))
    expect(dealt).toEqual([{ type: 'physical', amount: 600, source: { kind: 'item', id: 'moon', name: 'Moon' } }])
  })
})
