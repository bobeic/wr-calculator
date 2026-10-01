import { describe, it, expect } from 'vitest'
import { EFFECT_HANDLERS, contributeStats, stageOf } from '../../src/effects/registry'
import type { StatContext } from '../../src/effects/types'

function ctx(): StatContext {
  return { level: 5, inputs: {}, statSoFar: () => 0 }
}

describe('EFFECT_HANDLERS', () => {
  it('registers every effect kind except custom', () => {
    expect(Object.keys(EFFECT_HANDLERS).sort()).toEqual([
      'abilityHitProc', 'active', 'combatRampAmp', 'cooldownRefund', 'damageAmp', 'damageReduction', 'damageWindowProc',
      'dot', 'empoweredAttack', 'heal', 'hitStackProc', 'onHit',
      'penetration', 'procEveryN', 'resistShred', 'shield', 'spellblade', 'stacking', 'stat',
      'statConversion', 'statMultiplier',
    ])
  })
})

describe('contributeStats', () => {
  it('dispatches to the registered handler for a known kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'stat' as const, stat: 'ad' as const, amount: 10,
    }
    const result = contributeStats(effect, ctx())
    expect(result).toHaveLength(1)
    expect(result[0].amount).toBe(10)
  })

  it('returns an empty array for custom, the one kind never registered by kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'does-not-exist',
    }
    expect(contributeStats(effect, ctx())).toEqual([])
  })
})

describe('stageOf', () => {
  it('returns the stage for a registered stat-contributing kind', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'statMultiplier' as const, stat: 'ad' as const, layer: 'bonus' as const, amount: 0.1,
    }
    expect(stageOf(effect)).toBe('multiplier')
  })

  it('returns undefined for a registered combat-only kind (it has no stage)', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'shield' as const, amount: 10, durationSeconds: 5,
    }
    expect(stageOf(effect)).toBeUndefined()
  })

  it('returns undefined for custom', () => {
    const effect = {
      id: 'e1', name: 'Test', description: '', support: 'full' as const,
      kind: 'custom' as const, handler: 'does-not-exist',
    }
    expect(stageOf(effect)).toBeUndefined()
  })
})
