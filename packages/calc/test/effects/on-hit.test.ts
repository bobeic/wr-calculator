import { describe, it, expect, vi } from 'vitest'
import { onHitHandler } from '../../src/effects/on-hit'
import type { HookContext, CombatantRuntime, DamageInstance } from '../../src/effects/types'
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
    dealDamage: vi.fn((input): DamageInstance => ({
      time: 0, source: input.source, type: input.type, raw: input.amount,
      mitigated: input.amount, targetHpAfter: 0,
    })),
    addDataWarning: vi.fn(), addUnverifiedRule: vi.fn(), conditionMet: () => true,
    ...overrides,
  }
}

const baseEffect = {
  id: 'e1', name: 'Test On-Hit', description: '', support: 'full' as const,
  kind: 'onHit' as const, damageType: 'physical' as const,
}

describe('onHitHandler.onBasicAttack', () => {
  it('deals flat on-hit damage', () => {
    const c = ctx()
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: 15 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith({
      type: 'physical', amount: 15, source: { kind: 'item', id: 'e1', name: 'Test On-Hit' },
    })
  })

  it('adds a percent-of-current-hp component', () => {
    const c = ctx({ opponent: runtime({ currentHp: 400 }) })
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, pctTargetCurrentHp: 0.05 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 20 }))
  })

  it('adds a percent-of-max-hp component from the opponent sheet', () => {
    const c = ctx({ opponentSheet: sheet({ total: { hp: 2000 } }) })
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, pctTargetMaxHp: 0.03 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 60 }))
  })

  it('adds a percent-of-missing-hp component', () => {
    const c = ctx({
      opponent: runtime({ currentHp: 300 }), opponentSheet: sheet({ total: { hp: 1000 } }),
    })
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, pctTargetMissingHp: 0.1 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 70 }))
  })

  it('adds a ratio of the attacker\'s own stat', () => {
    const c = ctx({ selfSheet: sheet({ total: { ad: 100 } }) })
    onHitHandler.hooks!.onBasicAttack!(
      { ...baseEffect, pctOwnStat: { stat: 'ad', ratio: 0.2 } }, c
    )
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 20 }))
  })

  it('clamps to minDamage and maxDamage', () => {
    const c = ctx()
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: 5, minDamage: 10 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 10 }))
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: 50, maxDamage: 30 }, c)
    expect(c.dealDamage).toHaveBeenCalledWith(expect.objectContaining({ amount: 30 }))
  })

  it('records a data warning when flat is null', () => {
    const c = ctx()
    onHitHandler.hooks!.onBasicAttack!({ ...baseEffect, flat: null }, c)
    expect(c.addDataWarning).toHaveBeenCalledWith('Test On-Hit: flat is unverified (null)')
  })
})
